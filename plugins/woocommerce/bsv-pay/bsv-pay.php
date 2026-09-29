<?php
/**
 * Plugin Name: BSV Pay for WooCommerce
 * Description: Pay with BSV. Set BSV_PAY_SERVER_URL and WEBHOOK_SECRET and the gateway is ready. Default network is testnet.
 * Version: 0.1.0
 * Requires Plugins: woocommerce
 * Text Domain: bsv-pay
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BSV_PAY_FILE', __FILE__);
define('BSV_PAY_DIR', plugin_dir_path(__FILE__));

add_action('plugins_loaded', function () {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }
    require_once BSV_PAY_DIR . 'includes/class-bsv-pay-client.php';
    require_once BSV_PAY_DIR . 'includes/class-wc-gateway-bsv.php';

    add_filter('woocommerce_payment_gateways', function ($gateways) {
        $gateways[] = 'WC_Gateway_BSV';
        return $gateways;
    });
});

add_action('woocommerce_api_bsv_pay', function () {
    if (!class_exists('WC_Gateway_BSV')) {
        require_once BSV_PAY_DIR . 'includes/class-bsv-pay-client.php';
        require_once BSV_PAY_DIR . 'includes/class-wc-gateway-bsv.php';
    }
    WC_Gateway_BSV::handle_webhook();
});

add_filter('script_loader_tag', function ($tag, $handle, $src) {
    if ($handle === 'bsv-pay-checkout') {
        return '<script type="module" src="' . esc_url($src) . '"></script>';
    }
    return $tag;
}, 10, 3);
