// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import focusSystem from "./focusSystem.js";
import notificationsHandler from "./notificationsHandler.js";
import {
  sendScheduledSilentNotificationEvery8Hours,
  sendScheduledSilentNotificationSundayNight
} from "./silentNotifications.js"; // Import the silent notification functions

// Initialize Firebase Admin SDK
initializeApp();

// Initialize Firestore
const db = getFirestore();

/*Focus system functions----------------------------------------------------------------*/

// Firestore trigger functions
export const checkPhysicalityTaskCompletion = onDocumentUpdated(
  "physicality_objectives/{taskID}",
  (event) => focusSystem.checkTaskCompletion(event, db)
);

export const checkMindfulnessTaskCompletion = onDocumentUpdated(
  "mindfulness_objectives/{taskID}",
  (event) => focusSystem.checkTaskCompletion(event, db)
);

export const checkProfessionTaskCompletion = onDocumentUpdated(
  "profession_objectives/{taskID}",
  (event) => focusSystem.checkTaskCompletion(event, db)
);

// Scheduled functions
export const runDailyFunctions = onSchedule('every day 00:00', async (context) => {
  try {
      await focusSystem.handleDailyFunctions(db);
      logger.info("Daily functions executed successfully.");
  } catch (error) {
      logger.error("Error executing daily functions:", error);
      throw new Error("Failed to execute daily functions.");
  }
});

export const runWeeklyFunctions = onSchedule('every monday 00:00', async (context) => {
  try {
      await focusSystem.handleWeeklyFunctions(db);
      logger.info("Weekly functions executed successfully.");
  } catch (error) {
      logger.error("Error executing weekly functions:", error);
      throw new Error("Failed to execute weekly functions.");
  }
});

/*--------------------------------------------------------------------------------------*/

/*Push notification functions-----------------------------------------------------------*/

// Could update this to run based on user retention data (last active/login date field and check that value to determine when to send)
export const sendMotivationPushNotifications = onSchedule('0 12 */2 * *', async (context) => {
  try {
      await handleMotivationMessages();
      logger.info("Motivation push notifications sent successfully.");
  } catch (error) {
      logger.error("Error sending motivation push notifications:", error);
      throw new Error("Failed to send motivation push notifications.");
  }
});



export const sendFriendRequestNotifications = onDocumentUpdated(
  "users/{userID}/friend_requests/requests",
  (event) => {
    notificationsHandler.handleFriendRequests(event, db);
  }
);

export const sendFriendAcceptanceNotifications = onDocumentCreated(
  "users/{userID}/friends/{friendID}",
  (event) => notificationsHandler.handleFriendAcceptance(event, db)
);

export const sendRatingDecreaseNotifications = onDocumentUpdated(
  "users/{userID}",
  (event) => notificationsHandler.handleProfileUpdates(event, db)
);

/*--------------------------------------------------------------------------------------*/

/*Silent notification functions----------------------------------------------------------*/

export { sendScheduledSilentNotificationEvery8Hours, sendScheduledSilentNotificationSundayNight };