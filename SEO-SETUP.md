# Heera Estate SEO deployment checklist

The codebase now supplies unique metadata, canonical URLs, crawl directives,
structured data, server-rendered listing links, location landing pages, and a
dynamic XML sitemap. Complete these deployment steps after uploading the site.

## 1. Configure the production identity

Set these environment values in the hosting control panel or Apache config:

```text
HEERA_SITE_URL=https://www.heeraestate.com
HEERA_SITE_NAME=Heera Estate
HEERA_PHONE=+923091496014
HEERA_STREET_ADDRESS=85, Hassan Commercial Zone, Gate 4, Al Rehman Garden Phase 2, Faizpur Interchange
HEERA_CITY=Lahore
HEERA_REGION=Punjab
HEERA_COUNTRY=PK
```

Optionally add `HEERA_LATITUDE`, `HEERA_LONGITUDE`, and comma-separated official
profile links in `HEERA_SOCIAL_URLS`. Never upload a real `.env` file publicly.

## 2. Repair the existing database

Select the website database in phpMyAdmin and import
`project-schema-repair.sql`. It is repeat-safe and now repairs the fields needed
by public property pages, sub-project URLs, project media, payment plans, and
optional map files.

The final phpMyAdmin result table shows whether each property is public or hidden
because of its status/start/end date. For a page such as `property.php?id=8`, the
row must exist, have status `available`, and be inside its publication dates.

## 3. Connect Google

1. Add the domain property in Google Search Console.
2. Put the verification token in `HEERA_GOOGLE_SITE_VERIFICATION`.
3. Submit `https://www.heeraestate.com/sitemap.xml`.
4. Inspect the homepage, one property, one project, one sub-project, and one
   location URL in Search Console after deployment.
5. Test those same pages with Google's Rich Results Test.

Optional analytics can be enabled with `HEERA_GA_MEASUREMENT_ID=G-XXXXXXXXXX`.

## 4. Publishing rules

- Keep each public property title specific: size, property type, project/block,
  and location.
- Write a useful original description for every property, project, and
  sub-project. Avoid copying the same paragraph across records.
- Upload clear original images and enter meaningful gallery captions.
- Set projects and sub-projects to `published` only when ready.
- Keep property status `available` and publication dates current while a listing
  should appear publicly.
- Use one stable URL for each record; do not manually change generated slugs.

SEO improves eligibility and crawlability but does not guarantee rankings.
