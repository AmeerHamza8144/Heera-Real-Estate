# Task Checklist

## 1. Database Changes
- [x] Create `upgrade-payment-plans.sql` with `payment_plans` table

## 2. API Changes (api.php)
- [x] Make `price` (USD) optional in `save_property` validation (use `price_pkr` as primary)
- [x] Add payment plan functions `paymentPlans()` and `savePaymentPlans()`
- [x] Return payment plans with property listings in `listings()` and `admin_properties`

## 3. Admin HTML (admin.html)
- [ ] Remove "Price (USD)" field from form
- [ ] Change "Total price (PKR)" to primary pricing field
- [ ] Add conditional visibility for beds/baths based on property type (hide when Land)
- [ ] Add Payment Plan section with dynamic row management (add/remove rows)
- [ ] Style payment plan rows with good CSS

## 4. Admin JS (admin.js)
- [ ] Add property_type change handler to show/hide beds/baths
- [ ] Add payment plan dynamic row logic (add row, remove row)
- [ ] Include payment plan data in form submission
- [ ] Load and populate payment plans when editing a property
- [ ] Update renderPropertyList to show PKR

## 5. Frontend (index.html & script.js)
- [ ] Display PKR price on property cards
- [ ] Display payment plan details on property cards / detail view

## 6. Important Updates (landing-page ticker)
- [x] Backend: `home_popups` remains as the compatibility endpoint for published updates
- [x] Backend: existing `popup_ads` records are preserved
- [x] Frontend: published text updates move across the top of the landing page
- [x] Frontend: old promotional popup screen removed
- [x] Admin: Important Updates can add, edit, order, publish, and delete ticker messages
