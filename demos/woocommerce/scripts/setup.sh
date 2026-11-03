#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d
echo "Waiting for WordPress files..."
for i in $(seq 1 60); do
  if docker compose run --rm wpcli wp core is-installed >/dev/null 2>&1; then
    break
  fi
  docker compose run --rm wpcli wp core install \
    --url="http://localhost:8080" \
    --title="BSV Hats" \
    --admin_user="admin" \
    --admin_password="admin" \
    --admin_email="admin@example.com" \
    --skip-email && break
  sleep 3
done
docker compose run --rm wpcli wp plugin install woocommerce --version=9.9.7 --activate
docker compose run --rm wpcli wp plugin activate bsv-pay
docker compose run --rm wpcli wp option update woocommerce_currency USD
docker compose run --rm wpcli wp option update woocommerce_store_address "1 Testnet Way"
docker compose run --rm wpcli wp option update woocommerce_store_city "Austin"
docker compose run --rm wpcli wp option update woocommerce_default_country "US:TX"
docker compose run --rm wpcli wp option update woocommerce_onboarding_profile_completed yes
docker compose run --rm wpcli wp wc tool run install_pages --user=1 || true

python3 - <<'PY'
import pathlib
hats = [
    ("Testnet Trucker", "24.00", "Foam front, mesh back, testnet gold."),
    ("Genesis Fedora", "86.00", "Pinched crown, wide brim, first-block felt."),
    ("Block Beanie", "18.00", "Ribbed knit for long confirmation nights."),
    ("Satoshi Cap", "32.00", "Unstructured cap, curved brim, quiet logo."),
    ("Miner Bucket", "28.00", "Downward brim, ochre cloth, full shade."),
    ("Paymail Panama", "42.00", "Straw weave with a navy band."),
]
pathlib.Path("/tmp/bsv-hats-products.txt").write_text("\n".join(f"{n}|{p}|{b}" for n, p, b in hats))
print("product list ready", len(hats))
PY

while IFS='|' read -r name price blurb; do
  docker compose run --rm -T wpcli wp wc product create \
    --name="$name" --regular_price="$price" --short_description="$blurb" \
    --virtual=true --user=1 --status=publish </dev/null || true
done < /tmp/bsv-hats-products.txt

docker compose run --rm -T wpcli wp theme activate bsv-hats </dev/null
SHOP_ID=$(docker compose run --rm -T wpcli wp option get woocommerce_shop_page_id </dev/null | tail -n 1 | tr -d '[:space:]')
CHECKOUT_ID=$(docker compose run --rm -T wpcli wp option get woocommerce_checkout_page_id </dev/null | tail -n 1 | tr -d '[:space:]')
docker compose run --rm -T wpcli wp option update show_on_front page </dev/null
docker compose run --rm -T wpcli wp option update page_on_front "$SHOP_ID" </dev/null
docker compose run --rm -T wpcli wp post update "$CHECKOUT_ID" --post_content='<!-- wp:shortcode -->[woocommerce_checkout]<!-- /wp:shortcode -->' </dev/null
docker compose run --rm -T wpcli wp option patch update woocommerce_bsv_pay_settings enabled yes </dev/null
docker compose run --rm -T wpcli wp option patch update woocommerce_bsv_pay_settings title "Pay with BSV" </dev/null
echo "BSV Hats is at http://localhost:8080 (admin / admin)"
