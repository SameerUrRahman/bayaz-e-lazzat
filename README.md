# Bayaz-e-Lazzat — بیاضِ لذّت

*An anthology of Hyderabad's delights.* A personally curated, parchment-styled
interactive map of Hyderabad's food spots — with cuisine/area filters, diamond
ratings (a nod to Golconda), and cinematic fly-through food trails.

**Bayaz** — a poet's personal anthology in the Urdu literary tradition.
**Lazzat** — delight, after the Nizam's 1894 royal cookbook *Tohfat-ul-Lazzaat*.

## Stack

React + Vite · MapLibre GL JS · Tailwind CSS v4 · static JSON data · Vercel

## Run it

```bash
npm install
npm run dev
```

Works out of the box on OpenFreeMap fallback tiles. To unlock the terrain +
hillshade layer:

1. Create a free account at [cloud.maptiler.com](https://cloud.maptiler.com/) (no credit card)
2. Copy your key from **Account → Keys**
3. `copy .env.example .env` and paste the key into `VITE_MAPTILER_KEY=`
4. Restart `npm run dev`

## Add a restaurant

Append an entry to `src/data/restaurants.json`:

```json
{
  "id": "unique-slug",
  "name": "Place Name",
  "urdu": "اردو نام",
  "lat": 17.0,
  "lng": 78.0,
  "cuisine": "Hyderabadi",
  "area": "Old City",
  "rating": 4,
  "review": "One-liner review.",
  "mapsQuery": "Place Name Area Hyderabad"
}
```

Get lat/lng from Google Maps: right-click the spot → the first menu item
copies the coordinates. New cuisines/areas show up in the filters
automatically.

## Add a trail

Append to `src/data/trails.json` with ordered `restaurantId` stops and a note
per stop. (MVP renders the first trail; a multi-trail picker is on the
roadmap.)

## Roadmap (post-MVP)

- Photos on detail cards
- Multiple trails + trail picker
- Neighborhood personality styling
- Data entry form / workflow
- 3D building tilt toggle
