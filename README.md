# Food Delivery

Food Delivery is a role-based, multi-shop ordering application. Customers discover shops and food in their city, build a cart, place COD or Razorpay orders, track delivery, chat with the delivery partner, rate items and delivery partners, and raise support tickets. Shop owners manage their shop and menu, process orders, create coupons, resolve tickets, and view analytics. Delivery partners receive nearby assignments, accept work, verify delivery with an OTP, and see delivery statistics.

This repository contains two independently runnable applications:

- [`frontend/`](./frontend/) - React 19 and Vite browser application.
- [`backend/`](./backend/) - Express 5 API, Socket.IO server, and MongoDB persistence.

The detailed implementation notes are in [`docs/frontend.md`](./docs/frontend.md) and [`docs/backend.md`](./docs/backend.md).

## Features

### Customer

- Email/password sign-up and sign-in, Google sign-in, sign-out, and email OTP password reset.
- Browser geolocation with Geoapify reverse geocoding to determine city, state, and address.
- City-based shop and item discovery plus name/category search.
- Cart management, coupon application, delivery address selection, COD checkout, and Razorpay checkout.
- Order history and order tracking, including delivery-partner location updates.
- Item and delivery-partner ratings after delivery.
- Order-specific chat with the delivery partner.
- Support ticket creation and ticket status viewing.

### Shop owner

- Create or edit one shop and upload its image.
- Add, edit, and delete menu items with image uploads.
- View shop orders and advance their status.
- Move an order to delivery, which creates a delivery assignment for available nearby delivery partners.
- Create and delete coupons.
- View sales, top-item, and order-status analytics.
- View and resolve customer tickets.

### Delivery partner

- Receive assignments broadcast to nearby available delivery partners.
- Accept one assignment at a time.
- Update location while delivering.
- Send a delivery OTP to the customer and complete delivery after OTP verification.
- View current delivery, delivery statistics, and ratings.
- Chat with the customer for an order.

## Architecture

```text
Browser (React/Vite)
  ├─ React Router pages and role dashboards
  ├─ Redux Toolkit: user, owner, map, cart, and order state
  ├─ Axios + httpOnly cookie credentials
  ├─ Geoapify, Firebase Google Auth, Razorpay checkout
  └─ Socket.IO client for notifications, chat, and tracking
                 │ HTTP / WebSocket
                 ▼
Express + Socket.IO server
  ├─ Cookie JWT authentication middleware
  ├─ Route modules and controllers
  ├─ Mongoose models and MongoDB
  ├─ Cloudinary image storage
  ├─ Nodemailer OTP and delivery email
  └─ Razorpay order/payment verification
```

The backend stores a top-level `Order` with one embedded `shopOrder` per shop. This allows one checkout to contain items from several shops while each shop can independently advance its own fulfillment status. Delivery assignments are separate documents because they are a transient, competing resource shared by delivery partners.

## Local development

### Prerequisites

- Node.js and npm
- MongoDB (the configured URI may point to MongoDB Atlas)
- Credentials for the optional integrations used by the features you enable

### Configuration

Do not commit either `.env` file or copy real values into documentation. The backend reads these variable names:

`PORT`, `JWT_SECRET`, `MONGO_URI`, `EMAIL`, `PASSWORD`, `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`, `RAZORPAY_KEY`, `RAZORPAY_SECRET`

The frontend reads these Vite variable names:

`VITE_APIKEY`, `VITE_AUTHDOMAIN`, `VITE_PROJECTID`, `VITE_STORAGEBUCKET`, `VITE_MESSAGINGSENDERID`, `VITE_APPID`, `VITE_MEASUREMENTID`, `VITE_GEOAPI_KEY`, `VITE_RAZOPAY_KEY`

### Start the applications

```powershell
cd backend
npm install
npm run dev
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The current development configuration expects the API at `http://localhost:5000/` and the Vite client at `http://localhost:5173`.

Useful frontend commands:

```powershell
npm run lint
npm run build
npm run preview
```

The optional `backend/createIndex.js` script ensures the `users.location` 2dsphere index exists. The normal server startup also ensures this index through [`backend/config/db.js`](./backend/config/db.js).

## Important implementation decisions and trade-offs

- **JWT in an httpOnly cookie:** reduces exposure to client-side JavaScript and keeps API calls simple, but requires `withCredentials`, a matching CORS origin, and appropriate production `secure`/`sameSite` settings.
- **Role-based UI and API checks:** keeps customer, owner, and delivery workflows distinct. Some controller authorization checks are resource-specific while some owner actions, such as coupon deletion and ticket resolution, currently rely on the authenticated route rather than rechecking ownership; this should be tightened before production.
- **Redux state instead of a server cart:** makes cart interactions responsive and keeps the backend stateless before checkout, but the cart is lost on refresh and totals are supplied by the client. A production system should recalculate prices and discounts server-side.
- **Embedded shop orders:** makes a multi-shop checkout easy to read and update per shop, but deeply nested order documents make reporting and partial updates more complex.
- **Socket.IO plus REST:** REST remains the source of truth and works after reconnects; sockets provide low-latency status, location, assignment, and chat notifications. Clients still fetch data initially and should tolerate missed events.
- **Cloudinary for images:** avoids storing binary media in MongoDB and returns CDN URLs, at the cost of an external dependency and the need for upload cleanup/error handling.
- **GeoJSON and a 2dsphere index:** supports nearby delivery-partner selection efficiently. The assignment logic searches within 10 km and falls back to all delivery partners when none are nearby.

## Further documentation

- [`docs/frontend.md`](./docs/frontend.md) describes the client structure, routes, state, integrations, and UI trade-offs.
- [`docs/backend.md`](./docs/backend.md) describes the server structure, data model, authentication, API endpoints, socket events, and backend trade-offs.
