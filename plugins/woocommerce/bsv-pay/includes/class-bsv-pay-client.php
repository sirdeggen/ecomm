<?php

if (!defined('ABSPATH') && !defined('BSV_PAY_TEST')) {
    exit;
}

class BSV_Pay_Client {
    public function __construct(private string $base_url, private string $webhook_secret) {
        $this->base_url = rtrim($base_url, '/');
    }

    public function create_invoice(array $payload): array {
        return $this->request('POST', '/v1/invoices', $payload);
    }

    public function get_invoice(string $id): array {
        return $this->request('GET', '/v1/invoices/' . rawurlencode($id));
    }

    public static function sign(string $body, string $secret): string {
        return 'sha256=' . hash_hmac('sha256', $body, $secret);
    }

    public static function signature_valid(string $body, string $header, string $secret): bool {
        $expected = self::sign($body, $secret);
        if (strlen($expected) !== strlen($header)) {
            return false;
        }
        return hash_equals($expected, $header);
    }

    private function request(string $method, string $path, ?array $body = null): array {
        $args = [
            'method' => $method,
            'timeout' => 20,
            'headers' => ['Content-Type' => 'application/json'],
        ];
        $json = function_exists('wp_json_encode') ? wp_json_encode($body) : json_encode($body);
        if ($body !== null) {
            $args['body'] = $json;
        }
        if (function_exists('wp_remote_request')) {
            $response = wp_remote_request($this->base_url . $path, $args);
            if (is_wp_error($response)) {
                throw new RuntimeException($response->get_error_message());
            }
            $status = wp_remote_retrieve_response_code($response);
            $raw = wp_remote_retrieve_body($response);
        } else {
            $ch = curl_init($this->base_url . $path);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            }
            $raw = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);
        }
        $decoded = json_decode($raw ?: '', true);
        if ($status >= 400 || !is_array($decoded)) {
            $message = is_array($decoded) ? ($decoded['message'] ?? 'payment server error') : 'payment server error';
            throw new RuntimeException($message);
        }
        return $decoded;
    }
}
