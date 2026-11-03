<?php

if (!defined('ABSPATH')) {
    exit;
}

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('woocommerce');
});

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'bsv-hats-fonts',
        'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Source+Sans+3:wght@400;600;700&display=swap',
        [],
        null
    );
    wp_enqueue_style('bsv-hats', get_stylesheet_uri(), ['bsv-hats-fonts'], '0.1.0');
});

add_filter('body_class', function ($classes) {
    $classes[] = 'bsv-hats';
    return $classes;
});

add_action('woocommerce_before_shop_loop', function () {
    if (function_exists('is_shop') && is_shop()) {
        echo '<p class="lede">Six hats. One payment. The shopper pays from a BSV wallet on testnet, with a QR or paymail fallback. No account.</p>';
    }
}, 5);

add_action('woocommerce_before_shop_loop_item_title', function () {
    $name = get_the_title();
    $accents = [
        'Testnet Trucker' => ['#d7a441', '#0e1c33'],
        'Genesis Fedora' => ['#6b3f2a', '#2a2118'],
        'Block Beanie' => ['#1f6b45', '#143d28'],
        'Satoshi Cap' => ['#1c1c1c', '#111111'],
        'Miner Bucket' => ['#c47b2b', '#8d5a22'],
        'Paymail Panama' => ['#e6d3a3', '#cbb98a'],
    ];
    $pair = $accents[$name] ?? ['#c8922a', '#10203a'];
    echo '<svg viewBox="0 0 240 140" width="100%" height="120" aria-hidden="true">';
    echo '<rect width="240" height="140" rx="16" fill="#f6f1e7" />';
    echo '<ellipse cx="120" cy="108" rx="78" ry="14" fill="' . esc_attr($pair[1]) . '" />';
    echo '<path d="M70 92c6-38 28-58 50-58s44 20 50 58" fill="' . esc_attr($pair[0]) . '" />';
    echo '<path d="M78 78c10-8 22-12 42-12s32 4 42 12" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="4" />';
    echo '<circle cx="168" cy="70" r="4" fill="#f4efe4" />';
    echo '</svg>';
}, 9);
