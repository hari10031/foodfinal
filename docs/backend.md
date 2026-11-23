# Backend documentation

The backend is an Express 5 and Socket.IO server under [`backend/`](../backend/). [`index.js`](../backend/index.js) loads environment variables, configures middleware, mounts API routers, initializes Socket.IO, and starts the HTTP server. MongoDB is connected by [`config/db.js`](../backend/config/db.js).

## Request lifecycle

1. Express parses URL-encoded and JSON bodies and parses cookies.
2. CORS allows the configured local frontend origin with credentials.
3. Routers under `/api/*` dispatch to controllers.
4. `isAuth` verifies the `token` cookie with `JWT_SECRET` and sets `req.userId`.
5. Controllers validate input, query/update Mongoose documents, call integrations, and return JSON.
6. Selected mutations emit Socket.IO events to user, owner, delivery, order, or chat rooms.

Authentication uses a seven-day JWT in an httpOnly cookie. Passwords are hashed with bcrypt. Authenticated requests must send cookies; the frontend therefore uses Axios `withCredentials`.

## Data model

| Model | Purpose |
| --- | --- |
| `User` | Identity, role (`user`, `owner`, `deliveryboy`), reset OTP, GeoJSON location, and delivery statistics. |
| `Shop` | Owner-owned shop, image URL, city/state/address, and item references. |
| `Item` | Menu item, Cloudinary image URL, category, price, food type, and denormalized rating summary. |
| `Order` | Customer, payment details, address, totals, coupon information, and embedded `shopOrders`. |
| `DeliveryAssignment` | Broadcast/assigned/completed delivery work linked to an order and shop order. |
| `Rating` | Customer item rating scoped to an order; duplicate user/item/order ratings are indexed uniquely. |
| `DeliveryBoyRating` | Customer delivery rating scoped to a shop order; duplicate ratings are indexed uniquely. |
| `Coupon` | Shop coupon, flat/percentage discount, minimum amount, cap, and expiration. |
| `Ticket` | Customer support issue associated with an order and shop. |
| `Chat` | Order/shop-order conversation with embedded messages and active/unread state. |

Orders are intentionally split into embedded shop orders. A shop owner can update only the relevant shop order status. When a shop order becomes `out of delivery`, the controller uses the `users.location` 2dsphere index to find delivery partners within 10 km, removes busy partners, and creates a broadcast assignment.

## HTTP API

The base URL is `http://localhost:5000`. `Auth` means no JWT middleware is attached by the route; `Auth required` means the request must include the httpOnly `token` cookie. All request bodies are JSON unless marked `multipart/form-data`.

### Authentication

| Method and path | Auth | Body / purpose |
| --- | --- | --- |
| `POST /api/auth/signup` | Auth | `fullName`, `email`, `password`, `mobile`, `role`; creates a hashed-password user and cookie. |
| `POST /api/auth/signin` | Auth | `email`, `password`; verifies credentials and sets cookie. |
| `GET /api/auth/signout` | Auth | Clears the token cookie. |
| `POST /api/auth/send-otp` | Auth | `email`; stores a ten-minute reset OTP and emails it. |
| `POST /api/auth/verify-otp` | Auth | `email`, `otp`; verifies and consumes the OTP. |
| `POST /api/auth/reset-password` | Auth | `email`, `newPassword`; requires a verified reset OTP. |
| `POST /api/auth/google-auth` | Auth | `fullName`, `email`, `role`, `mobile`; finds/creates a user and sets cookie. |

### Users and shops

| Method and path | Auth | Body / purpose |
| --- | --- | --- |
| `GET /api/user/current` | Auth required | Returns the current user. |
| `POST /api/user/update-location` | Auth required | `lat`, `lon`; stores GeoJSON coordinates and emits delivery tracking updates when applicable. |
| `GET /api/user/delivery-stats` | Auth required | Delivery partner statistics; rejects non-delivery roles. |
| `PUT /api/user/update-details` | Auth required | `fullName`, `email`, `mobile`. |
| `POST /api/shop/create-edit` | Auth required | Multipart fields `name`, `city`, `state`, `address`, optional `image`; creates or updates the owner’s shop. |
| `GET /api/shop/get-my` | Auth required | Returns the owner’s shop and items, or `null`. |
| `GET /api/shop/get-by-city/:city` | Auth required | Returns matching shops and populated items. |

### Menu items

| Method and path | Auth | Body / purpose |
| --- | --- | --- |
| `POST /api/item/add-item` | Auth required | Multipart `name`, `category`, `foodType`, `price`, optional `image`; adds to the owner’s shop. |
| `POST /api/item/edit-item/:itemId` | Auth required | Multipart item fields and optional `image`; checks item ownership. |
| `GET /api/item/get-by-id/:itemId` | Auth required | Returns one item. |
| `DELETE /api/item/delete/:itemId` | Auth required | Checks ownership, deletes item, and removes its shop reference. |
| `GET /api/item/get-by-city/:city` | Auth required | Returns items belonging to shops in a city. |
| `GET /api/item/get-by-shop/:shopId` | Auth required | Returns the shop and its populated items. |
| `GET /api/item/search-items?query=...&city=...` | Auth required | Searches item name/category within the city. |

### Orders and delivery

| Method and path | Auth | Body / purpose |
| --- | --- | --- |
| `POST /api/order/place-order` | Auth required | `cartItems`, `paymentMethod`, `deliveryAddress {text, latitude, longitude}`, `totalAmount`, optional `couponCode`, `discountAmount`; creates COD order or a Razorpay order. |
| `POST /api/order/verify-payment` | Auth required | `razorpay_payment_id`, `orderId`; confirms captured payment and notifies owners. |
| `GET /api/order/my-orders` | Auth required | Returns a role-shaped order view for customer, owner, or delivery partner. |
| `POST /api/order/update-status/:orderId/:shopId` | Auth required | `status`; owner updates a shop order and can trigger delivery assignment. |
| `GET /api/order/get-assignments` | Auth required | Delivery partner’s broadcast assignments. |
| `GET /api/order/accept-order/:assignmentId` | Auth required | Delivery partner claims an unclaimed assignment. |
| `GET /api/order/get-current-order` | Auth required | Current assigned delivery order. |
| `GET /api/order/get-order-by-id/:orderId` | Auth required | Retrieves an order for tracking. |
| `POST /api/order/send-delivery-otp` | Auth required | `orderId`, `shopOrderId`; emails an OTP to the customer. |
| `POST /api/order/verify-delivery-otp` | Auth required | `orderId`, `shopOrderId`, `otp`; marks the shop order delivered and updates delivery stats/events. |
| `GET /api/order/owner-analytics` | Auth required | Aggregated owner sales, top items, trends, and status distribution. |

### Ratings, support, coupons, and chat

| Method and path | Auth | Body / purpose |
| --- | --- | --- |
| `POST /api/rating/item` | Auth required | `itemId`, `orderId`, `rating`, optional `review`; only the customer who ordered the item can rate it. |
| `POST /api/rating/delivery-boy` | Auth required | `deliveryBoyId`, `orderId`, `shopOrderId`, `rating`, optional `review`; only after delivery. |
| `GET /api/rating/item/:itemId` | Auth | Item ratings and aggregate. |
| `GET /api/rating/delivery-boy/:deliveryBoyId` | Auth | Delivery ratings and aggregate. |
| `GET /api/rating/status/:orderId/:shopOrderId` | Auth required | Whether the delivered shop order can be rated and its rating flags. |
| `POST /api/rating/mark-items-rated` | Auth required | `orderId`, `shopOrderId`; marks item-rating UI completion. |
| `POST /api/ticket/create` | Auth required | `orderId`, `shopId`, `subject`, `description`. |
| `GET /api/ticket/user-tickets` | Auth required | Current customer’s tickets. |
| `GET /api/ticket/owner-tickets` | Auth required | Tickets for the owner’s shops. |
| `PUT /api/ticket/resolve/:ticketId` | Auth required | Optional `resolutionNote`; marks a ticket resolved. |
| `POST /api/coupon/create` | Auth required | `code`, `shopId`, `discountType`, `discountValue`, `minOrderAmount`, optional `maxDiscountAmount`, `expirationDate`. |
| `GET /api/coupon/shop/:shopId` | Auth | Active, non-expired shop coupons. |
| `POST /api/coupon/apply` | Auth required | `code`, `shopId`, `orderAmount`; returns calculated discount. |
| `DELETE /api/coupon/:couponId` | Auth required | Deletes a coupon. |
| `GET /api/chat/my-chats` | Auth required | Active chats for the current customer or delivery partner. |
| `GET /api/chat/order/:orderId/:shopOrderId` | Auth required | Gets or creates a chat after a delivery partner is assigned. |
| `GET /api/chat/:chatId` | Auth required | Returns messages if the caller belongs to the chat. |
| `POST /api/chat/:chatId/message` | Auth required | `content`; persists and emits a `new_message` event. |
| `PUT /api/chat/:chatId/read` | Auth required | Marks messages from the other participant as read. |

## Socket.IO contract

The server accepts connections from the local frontend origin. The client can emit:

- `join(userId)` -> `user-{userId}`
- `join-delivery-boy(deliveryBoyId)` -> `deliveryboy-{deliveryBoyId}`
- `join-order(orderId)` -> `order-{orderId}`
- `leave-order(orderId)`
- `join-chat(chatId)` -> `chat-{chatId}`
- `leave-chat(chatId)`
- `typing({ chatId, userId, isTyping })`
- `update-location({ orderId, latitude, longitude, deliveryBoyId })`

Important server-emitted events include `new-order`, `order-status-updated`, `new-delivery-assignment`, `delivery-accepted`, `delivery-location-updated`, `order-delivered`, `delivery-completed`, `new_message`, and `user-typing`.

## External services and environment

Backend environment variable names are declared in the repository’s local `.env` files but their values must remain private:

- MongoDB: `MONGO_URI`
- JWT: `JWT_SECRET`
- Email/OTP: `EMAIL`, `PASSWORD`
- Cloudinary: `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`
- Razorpay: `RAZORPAY_KEY`, `RAZORPAY_SECRET`
- Server port: `PORT`

Multer receives image uploads, Cloudinary stores them, and the temporary local file is removed after upload. Nodemailer sends password-reset and delivery OTP messages. Razorpay payment status is fetched server-side rather than trusted from the browser.

## Backend trade-offs and follow-up work

1. **Cookie JWT instead of a server session store:** simple horizontal deployment and no session table, but revocation is limited until expiry and production cookie/CORS settings must be hardened.
2. **Controller-centric business logic:** keeps route files small and makes feature behavior easy to locate, but validation and authorization are not centralized.
3. **Mongoose population and embedded shop orders:** convenient response shapes for dashboards and multi-shop fulfillment, but aggregation/reporting is more involved.
4. **Nearby assignment with fallback:** avoids leaving an order unassigned when no partner is within 10 km, but the fallback can assign a distant partner and should eventually consider travel time/capacity.
5. **REST persistence plus Socket.IO notifications:** reliable data retrieval after reconnects, but event delivery is not durable and clients must refetch after connection loss.
6. **Third-party media, mail, payment, and geocoding services:** reduces infrastructure owned by this application, but local development and production reliability depend on external credentials and availability.
7. **Current local CORS and URLs:** minimizes setup for the current development environment, but deployment needs environment-based origins, API URLs, and secure cookies.
