# Irrigation Hub Studio ® 🏛️🌾

> **Accelerating Smarter Agriculture through High-End Digital Identity.**

Irrigation Hub Studio is a premium, role-based management system designed for modern agricultural estates. Inspired by the "New Genre Studio" aesthetic, the platform combines clinical, typography-driven UI with robust IoT-ready protocols to manage irrigation cycles, monitor crop vitals, and issue system-wide broadcasts.

---

## 🏛️ Visual Philosophy
This project rejects the generic "SaaS dashboard" look. Instead, it utilizes:
- **Bento Grid Architecture**: Clean, geometric organization of data.
- **Editorial Typography**: High-contrast Serif headers (`Cormorant Garamond`) paired with technical Sans-serif details (`Inter`).
- **Monochromatic Palette**: A high-end dark/light theme system optimized for focus.
- **Cinematic Visuals**: Integration of architectural agricultural photography to ground the digital system in the physical world.

## ✨ Core Features
- **Role-Based Access Control**:
  - **Admin Studio**: Global registry management, system-wide overrides (HALT PROTOCOL), and real-time broadcasts.
  - **Farmer Studio**: Individual estate management, planting date tracking, and automated irrigation timers.
- **Atmospheric Intelligence**: Real-time weather integration to adjust irrigation protocols based on local conditions.
- **Command Center**: A pulsing administrative broadcast system that delivers "System Protocols" to all connected users in real-time.
- **Visual Analytics**: Interactive Chart.js integration visualizing hydration history and cultivar distribution.
- **Crop Lifecycle Engine**: Specialized irrigation suggestions based on the specific growth stage of each cultivar (Wheat, Corn, etc.).

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)

### Installation
1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd Project_V2
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/irrigation_hub
   JWT_SECRET=your_secret_key_here
   ```

4. **Run the application**:
   ```bash
   # Development mode with watch
   npm run dev

   # Production mode
   npm start
   ```

## 🛠️ Technology Stack
- **Backend**: Node.js, Express.js, MongoDB (Mongoose)
- **Frontend**: Vanilla JavaScript (ES6+), Modern CSS, HTML5
- **Visuals**: Chart.js, Toastify, Google Fonts
- **Auth**: JSON Web Tokens (JWT) & Bcryptjs

## 📡 Deployment
The project is configured for easy deployment on **Render** and **MongoDB Atlas**. See the `hosting_guide.md` in the documentation for detailed instructions.

---
*Created with focus by Antigravity Studio.*
