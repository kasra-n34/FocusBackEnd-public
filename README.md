# 🔧 Focus App – Backend

This repository contains the backend codebase for the **Focus iOS app**, powered by Firebase Cloud Functions and simulation tools written in Python. The backend handles points calculation, user tracking, leaderboard syncing, and app logic essential for supporting the Focus experience.

Focus was founded and led end-to-end by a team of 3 engineers, with this backend supporting a 100+ user TestFlight beta.

---

## 🛠️ Tech Stack

- **Firebase Cloud Functions** (JavaScript)
  Serverless backend that handles app logic, points computation, user updates, and leaderboard rankings. Also powers targeted, behavior-based push notifications.
- **Firebase Firestore**
  Cloud-based NoSQL database used to store user data, tasks, health sync info, and progress metrics.
- **Firebase Authentication**
  Google and Apple ID sign-in supporting the app's social layer.
- **Python (Simulations & Modeling)**
  Scripts to simulate different user behavior scenarios and visualize how long it takes to level up under varying conditions (e.g. daily task completion rates, activity levels). Used to design and balance the points system prior to launch.

---

## ⚙️ What the Backend Handles

- **Points & Leveling Logic**
  Computes point totals from completed tasks and synced Apple Health activity, translating consistent habits into measurable progress.
- **Social Layer**
  Backs friend requests, public and friends-only leaderboards, and a competitive ranking system across users.
- **User Data & Sync**
  Stores task, journal, and health sync data per user, keeping health information scoped to generating personal insights and point rewards.
- **Growth & Retention**
  Firebase Cloud Functions drive targeted push notifications, which contributed to a 15% improvement in 30-day user retention during beta testing.

---

## 📈 Results

- Supported **100+ TestFlight beta users** with real-time points, leaderboard, and sync logic
- Backend-driven push notifications improved **30-day retention by 15%**
- Points system modeled and balanced with a custom Python simulation before launch, rather than tuned by guesswork

---

## 🚧 Status

Built to support the Focus iOS app during 2024, with the codebase preserved here as a portfolio reference. 
