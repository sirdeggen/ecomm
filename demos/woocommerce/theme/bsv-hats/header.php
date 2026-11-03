<?php
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="site-header">
  <a class="wordmark" href="<?php echo esc_url(home_url('/')); ?>">BSV <span>Hats</span></a>
  <span class="platform-pill">WooCommerce · testnet</span>
  <a class="cart-link" href="<?php echo function_exists('wc_get_cart_url') ? esc_url(wc_get_cart_url()) : esc_url(home_url('/')); ?>">Cart</a>
</header>
<main class="shop-main">
