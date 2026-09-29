<?php
/**
 * Runs against a live payment server.
 *   BSV_PAY_SERVER_URL=http://127.0.0.1:4000 php tests/client-flow.php
 */
define('BSV_PAY_TEST', true);
require dirname(__DIR__) . '/includes/class-bsv-pay-client.php';

$secret = getenv('WEBHOOK_SECRET') ?: 'dev-webhook-secret';
$sig = BSV_Pay_Client::sign('{"ok":true}', $secret);
if (!BSV_Pay_Client::signature_valid('{"ok":true}', $sig, $secret)) {
    fwrite(STDERR, "signature check failed\n");
    exit(1);
}
if (BSV_Pay_Client::signature_valid('{"ok":true}', $sig, 'other-secret')) {
    fwrite(STDERR, "signature accepted a wrong secret\n");
    exit(1);
}

$base = getenv('BSV_PAY_SERVER_URL');
if (!$base) {
    echo "signature ok (set BSV_PAY_SERVER_URL to also create an invoice)\n";
    exit(0);
}

$client = new BSV_Pay_Client($base, $secret);
$invoice = $client->create_invoice([
    'orderRef' => 'woo-php-' . time(),
    'fiatAmount' => '18.00',
    'fiatCurrency' => 'USD',
    'platform' => 'woocommerce',
]);
if (($invoice['network'] ?? '') !== 'testnet' || empty($invoice['invoiceId'])) {
    fwrite(STDERR, "unexpected invoice\n");
    exit(1);
}
echo "invoice {$invoice['invoiceId']} {$invoice['address']}\n";
