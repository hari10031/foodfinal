# Frontend documentation

The frontend is a Vite-powered React application under [`frontend/`](../frontend/). The entry point is [`src/main.jsx`](../frontend/src/main.jsx), which mounts the app inside `BrowserRouter`, the Redux `Provider`, and `SocketProvider`.

## Responsibilities and structure

| Area | Implementation | Responsibility |
| --- | --- | --- |
| Routing | [`src/App.jsx`](../frontend/src/App.jsx) | Declares public/authenticated pages and redirects unauthenticated users to sign-in. |
| Pages | [`src/pages/`](../frontend/src/pages/) | Full-screen workflows such as sign-in, checkout, order tracking, dashboards, and profile editing. |
| Components | [`src/components/`](../frontend/src/components/) | Reusable cards, navigation, dashboards, ratings, chat, and delivery controls. |
| API bootstrap hooks | [`src/hooks/`](../frontend/src/hooks/) | Load the current user, location, city data, shop, items, and orders when app state changes. |
| Global state | [`src/redux/`](../frontend/src/redux/) | Stores user/session data, city results, cart, orders, owner shop data, and map coordinates. |
| Real-time state | [`src/context/SocketContext.jsx`](../frontend/src/context/SocketContext.jsx) | Opens a Socket.IO connection for an authenticated user and joins user/delivery rooms. |
| Styling | [`src/index.css`](../frontend/src/index.css) and Tailwind classes | Provides the global theme and utility-first layout styling. |

`Home.jsx` selects the dashboard based on `userData.user.role`: `user`, `owner`, or `deliveryboy`. This keeps the common shell shared while allowing each role to have a separate workflow.

## Browser routes

| Route | Purpose |
| --- | --- |
| `/signup`, `/signin`, `/forgot-password` | Authentication and password recovery. |
| `/` | Role-specific home dashboard. |
| `/create-edit-shop`, `/add-item`, `/edit-item/:itemId` | Owner shop and menu management. |
| `/shop/:shopId`, `/cart`, `/checkout`, `/order-placed` | Customer discovery and checkout. |
| `/my-orders`, `/track-order/:orderId` | Customer order history and tracking. |
| `/delivery-dashboard` | Delivery partner statistics and active delivery tools. |
| `/owner-analytics`, `/owner-tickets`, `/owner-coupons` | Owner reporting and management. |
| `/my-tickets`, `/profile` | Customer support and profile management. |

Route guards are authentication guards, not full role guards. Role-specific pages perform additional checks in their components, so a future improvement would be a reusable role-aware route guard.

## State and data flow

The Redux store has three slices:

- `user`: session response, current city/address, shops/items, cart, total, orders, and search results.
- `owner`: the authenticated owner’s shop and menu.
- `map`: selected latitude/longitude and address.

The cart is intentionally client-side. `addToCart`, `updateQuantity`, and `removeCartItem` immediately recompute `totalAmount`; checkout sends the cart to `POST /api/order/place-order`. The server currently uses the supplied item prices and total, so price validation is a backend hardening task.

Most API calls use Axios with `withCredentials: true`, allowing the browser to send the JWT cookie. The API base URL is currently the constant `serverUrl` in [`src/App.jsx`](../frontend/src/App.jsx), while some chat calls directly use the same localhost URL. This is straightforward for local development but should be replaced by a single environment-driven API client for deployment.

## Main user flows

### Authentication

Sign-up/sign-in responses contain a user and set the JWT cookie. On application load, `useGetCurrentUser` calls `/api/user/current` to restore the session. Google sign-in is performed by Firebase Auth, then the resulting identity details are sent to `/api/auth/google-auth`.

### Location and discovery

`useGetCity` requests browser geolocation, calls Geoapify reverse geocoding, and stores the city/state/address. The city then drives `/api/shop/get-by-city/:city` and `/api/item/get-by-city/:city`. Search uses `/api/item/search-items?query=...&city=...`.

### Checkout

`CheckOut.jsx` supports a draggable Leaflet map marker, reverse/forward Geoapify geocoding, and COD or Razorpay. COD immediately stores the returned order in Redux. Online checkout first creates a Razorpay order, opens the Razorpay browser flow, and calls `/api/order/verify-payment` after capture.

### Delivery and tracking

The delivery dashboard polls assignments/current order and also listens for Socket.IO completion events. The delivery partner’s location is posted to `/api/user/update-location`; the backend emits a `delivery-location-updated` event to the order room. Tracking pages can join that order room.

### Chat

`ChatWindow` obtains or creates an order chat through REST, joins its Socket.IO chat room, sends messages through REST, and receives recipient messages through `new_message`. REST is used for persistence and the socket is used for notification, preventing a reconnect from losing the source data.

## Frontend integrations

- **Firebase:** Google sign-in configuration is loaded from `VITE_*` variables in [`firebase.js`](../frontend/firebase.js).
- **Geoapify:** reverse and forward geocoding uses `VITE_GEOAPI_KEY`.
- **Leaflet/react-leaflet:** address selection and map display.
- **Razorpay:** the public checkout key is read from `VITE_RAZOPAY_KEY`; payment verification remains on the backend.
- **Cloudinary:** not called directly by the client; image forms use multipart uploads to the backend.

## Frontend trade-offs and follow-up work

1. **Redux Toolkit rather than local state everywhere:** shared cart/order/location state is convenient across pages, but there is no persistence or normalized entity cache.
2. **Hooks that fetch from `App`:** app-level hooks make the dashboard data available quickly, but they couple initialization to the root component and can issue requests whenever dependent state changes.
3. **Direct Axios calls in components:** low ceremony and easy to understand, but error handling, base URL, credentials, and response normalization are duplicated.
4. **Polling plus sockets for delivery:** polling is resilient to missed events, but can create unnecessary traffic. A production client should use a consistent reconnect/refetch strategy.
5. **Tailwind utility classes:** fast feature development and local consistency, but repeated long class lists can make visual changes harder to centralize.
6. **No TypeScript boundary:** the project is JavaScript/JSX, so API shape mistakes are discovered at runtime. Shared request/response types would improve maintainability.
