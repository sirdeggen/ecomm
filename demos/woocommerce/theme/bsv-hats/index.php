<?php
get_header();
if (have_posts()) {
    while (have_posts()) {
        the_post();
        echo '<article>';
        the_title('<h1 class="entry-title">', '</h1>');
        the_content();
        echo '</article>';
    }
}
get_footer();
