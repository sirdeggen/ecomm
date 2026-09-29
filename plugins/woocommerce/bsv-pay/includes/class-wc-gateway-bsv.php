<?php

if (!defined('ABSPATH')) {
    exit;
}

class WC_Gateway_BSV extends WC_Payment_Gateway {
    public function __construct() {
        $this->id = 'bsv_pay';
        $this->method_title = 'Pay with BSV';
        $this->method_description = 'Customer pays from a BSV wallet. No shopper account. Testnet by default.';
        $this->has_fields = true;
        $this->supports = ['products'];
        $this->init_form_fields();
        $this->init_settings();

        $this->title = $this->get_option('title', 'Pay with BSV');
        $this->description = $this->get_option('description', 'Pay with a BSV wallet, or scan the QR on the next page.');
        if ($this->server_url() && $this->get_option('enabled', '') === '') {
            $this->enabled = 'yes';
        }

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        add_action('woocommerce_thankyou_' . $this->id, [$this, 'render_payment_panel']);
    }

    public function init_form_fields() {
        $this->form_fields = [
            'enabled' => [
                'title' => 'Enable',
                'type' => 'checkbox',
                'label' => 'Enable Pay with BSV',
                'default' => getenv('BSV_PAY_SERVER_URL') ? 'yes' : 'no',
            ],
            'title' => [
                'title' => 'Title',
                'type' => 'text',
                'default' => 'Pay with BSV',
            ],
            'description' => [
                'title' => 'Description',
                'type' => 'textarea',
                'default' => 'Pay with a BSV wallet on the next page. No account.',
            ],
        ];
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);
        $client = new BSV_Pay_Client($this->server_url(), $this->webhook_secret());
        $invoice = $client->create_invoice([
            'orderRef' => 'woo-' . $order->get_id(),
            'fiatAmount' => $order->get_total(),
            'fiatCurrency' => $order->get_currency(),
            'platform' => 'woocommerce',
            'webhookUrl' => home_url('/?wc-api=bsv_pay'),
            'metadata' => ['wooOrderId' => $order->get_id()],
        ]);
        $order->update_meta_data('_bsv_invoice_id', $invoice['invoiceId']);
        $order->update_meta_data('_bsv_invoice', wp_json_encode($invoice));
        $order->update_status('on-hold', 'Awaiting BSV payment ' . $invoice['invoiceId']);
        $order->save();
        wc_reduce_stock_levels($order_id);
        WC()->cart->empty_cart();
        return [
            'result' => 'success',
            'redirect' => $this->get_return_url($order),
        ];
    }

    public function render_payment_panel($order_id) {
        $order = wc_get_order($order_id);
        $raw = $order->get_meta('_bsv_invoice');
        if (!$raw) {
            return;
        }
        $invoice = json_decode($raw, true);
        wp_enqueue_script('bsv-pay-checkout', plugins_url('assets/checkout.js', BSV_PAY_FILE), [], '0.1.0', true);
        echo '<div id="bsv-pay-root"></div>';
        echo '<script type="module">import { mount } from "' . esc_url(plugins_url('assets/checkout.js', BSV_PAY_FILE)) . '";';
        echo 'mount(document.getElementById("bsv-pay-root"), ' . wp_json_encode([
            'serverUrl' => $this->public_url(),
            'invoice' => $invoice,
        ]) . ');</script>';
    }

    public static function handle_webhook() {
        $body = file_get_contents('php://input') ?: '';
        $header = $_SERVER['HTTP_X_BSV_SIGNATURE'] ?? '';
        $secret = self::env_or_option('WEBHOOK_SECRET', 'webhook_secret');
        if (!BSV_Pay_Client::signature_valid($body, $header, $secret)) {
            status_header(401);
            echo 'invalid signature';
            exit;
        }
        $event = json_decode($body, true);
        if (!is_array($event) || ($event['type'] ?? '') !== 'invoice.paid') {
            status_header(400);
            exit;
        }
        $orders = wc_get_orders([
            'meta_key' => '_bsv_invoice_id',
            'meta_value' => $event['invoiceId'],
            'limit' => 1,
        ]);
        if (!$orders) {
            status_header(404);
            exit;
        }
        $order = $orders[0];
        if (!$order->is_paid()) {
            $order->payment_complete($event['txid']);
            $note = !empty($event['simulated'])
                ? 'Simulated BSV payment ' . $event['txid']
                : 'BSV payment ' . $event['txid'];
            $order->add_order_note($note);
        }
        status_header(200);
        echo 'ok';
        exit;
    }

    private function server_url(): string {
        $env = getenv('BSV_PAY_SERVER_URL');
        if ($env) {
            return rtrim($env, '/');
        }
        return rtrim((string) $this->get_option('server_url'), '/');
    }

    /** URL the shopper's browser uses. Defaults to the server URL. */
    private function public_url(): string {
        $env = getenv('BSV_PAY_PUBLIC_URL');
        if ($env) {
            return rtrim($env, '/');
        }
        return $this->server_url();
    }

    private function webhook_secret(): string {
        return self::env_or_option('WEBHOOK_SECRET', 'webhook_secret');
    }

    private static function env_or_option(string $env, string $option): string {
        $value = getenv($env);
        if ($value) {
            return $value;
        }
        $settings = get_option('woocommerce_bsv_pay_settings', []);
        return (string) ($settings[$option] ?? '');
    }
}
