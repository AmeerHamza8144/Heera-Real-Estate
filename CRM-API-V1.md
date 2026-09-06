# Heera Estate CRM API v1

## Public lead capture
`POST /api/v1/crm/leads`

Accepts: `name`, `email`, `phone`, `interest`, `property_id`, `message`, `budget_min`, `budget_max`, `preferred_project`, `preferred_location`, `preferred_property_type`, `preferred_size`, `preferred_listing_type`, `source`, `utm_source`, `utm_medium`, `utm_campaign`, `landing_page`, `referrer`.

The server calculates a lead score and automatic priority, then stores the lead in the shared `enquiries` CRM table.

## Admin CRM
- `GET /api/v1/admin/crm/leads`
- `GET /api/v1/admin/crm/stats`
- `POST /api/v1/admin/crm/leads/create`
- `POST /api/v1/admin/crm/leads/update`

Legacy actions `admin_enquiries` and `save_enquiry_status` remain aliases for compatibility.
