const admin = require("firebase-admin");

// Initialize Firebase Admin SDK only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const focusSystem = require("./focusSystem.js");
const notificationsHandler = require("./notificationsHandler.js");
const {
  sendScheduledSilentNotificationEvery8Hours,
  sendScheduledSilentNotificationSundayNight
} = require("./silentNotifications.js"); // Import the silent notification functions




// Initialize Firestore
const db = getFirestore();

/* Focus system functions ---------------------------------------------------------------- */

// Firestore trigger functions
exports.checkPhysicalityTaskCompletion = onDocumentUpdated(
  "physicality_objectives/{taskID}",
  (event) => focusSystem.checkTaskCompletion(event, db)
);

exports.checkMindfulnessTaskCompletion = onDocumentUpdated(
  "mindfulness_objectives/{taskID}",
  (event) => focusSystem.checkTaskCompletion(event, db)
);

exports.checkProfessionTaskCompletion = onDocumentUpdated(
  "profession_objectives/{taskID}",
  (event) => focusSystem.checkTaskCompletion(event, db)
);

// Scheduled functions
exports.runDailyFunctions = onSchedule("every day 00:00", async (context) => {
  try {
    await focusSystem.handleDailyFunctions(db);
    logger.info("Daily functions executed successfully.");
  } catch (error) {
    logger.error("Error executing daily functions:", error);
    throw new Error("Failed to execute daily functions.");
  }
});

exports.runWeeklyFunctions = onSchedule("every monday 00:00", async (context) => {
  try {
    await focusSystem.handleWeeklyFunctions(db);
    logger.info("Weekly functions executed successfully.");
  } catch (error) {
    logger.error("Error executing weekly functions:", error);
    throw new Error("Failed to execute weekly functions.");
  }
});

/* -------------------------------------------------------------------------------------- */

/* Push notification functions ----------------------------------------------------------- */

// Could update this to run based on user retention data (last active/login date field and check that value to determine when to send)
exports.sendMotivationPushNotifications = onSchedule("0 12 */2 * *", async (context) => {
  try {
    await handleMotivationMessages();
    logger.info("Motivation push notifications sent successfully.");
  } catch (error) {
    logger.error("Error sending motivation push notifications:", error);
    throw new Error("Failed to send motivation push notifications.");
  }
});

exports.sendFriendRequestNotifications = onDocumentUpdated(
  "users/{userID}/friend_requests/requests",
  (event) => {
    notificationsHandler.handleFriendRequests(event, db);
  }
);

exports.sendFriendAcceptanceNotifications = onDocumentCreated(
  "users/{userID}/friends/{friendID}",
  (event) => notificationsHandler.handleFriendAcceptance(event, db)
);

exports.sendRatingDecreaseNotifications = onDocumentUpdated(
  "users/{userID}",
  (event) => notificationsHandler.handleProfileUpdates(event, db)
);

/* -------------------------------------------------------------------------------------- */

/* Silent notification functions --------------------------------------------------------- */

exports.sendScheduledSilentNotificationEvery8Hours = sendScheduledSilentNotificationEvery8Hours;
exports.sendScheduledSilentNotificationSundayNight = sendScheduledSilentNotificationSundayNight;
