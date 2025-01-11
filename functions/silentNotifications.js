const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Use the already initialized Firebase Admin SDK
const messaging = admin.messaging(); // Get messaging service

// Function to send a silent push notification every 8 hours
exports.sendScheduledSilentNotificationEvery8Hours = functions.pubsub
    .schedule('0 */8 * * *')
    .onRun(async (context) => {
        try {
            const db = admin.firestore(); // Get Firestore instance
            const usersSnapshot = await db.collection('users').get();

            const promises = [];
            usersSnapshot.forEach((doc) => {
                const userData = doc.data();
                const fcmToken = userData.fcmToken;

                if (fcmToken) {
                    const message = {
                        token: fcmToken,
                        apns: {
                            payload: {
                                aps: {
                                    "content-available": 1
                                }
                            }
                        },
                        data: {
                            silent: "true"
                        }
                    };

                    promises.push(
                        messaging
                            .send(message)
                            .then((response) => {
                                console.log(`Notification sent successfully to ${doc.id}: ${response}`);
                            })
                            .catch((error) => {
                                console.error(`Error sending notification to ${doc.id}: `, error);
                            })
                    );
                }
            });

            await Promise.all(promises);
            console.log("All notifications sent successfully.");
        } catch (error) {
            console.error("Error sending notifications: ", error);
        }
    });

// Function to send a silent push notification every Sunday at 11:59 PM
exports.sendScheduledSilentNotificationSundayNight = functions.pubsub
    .schedule('59 23 * * 0')
    .onRun(async (context) => {
        try {
            const db = admin.firestore(); // Get Firestore instance
            const usersSnapshot = await db.collection('users').get();

            const promises = [];
            usersSnapshot.forEach((doc) => {
                const userData = doc.data();
                const fcmToken = userData.fcmToken;

                if (fcmToken) {
                    const message = {
                        token: fcmToken,
                        apns: {
                            payload: {
                                aps: {
                                    "content-available": 1
                                }
                            }
                        },
                        data: {
                            silent: "true"
                        }
                    };

                    promises.push(
                        messaging
                            .send(message)
                            .then((response) => {
                                console.log(`Notification sent successfully to ${doc.id}: ${response}`);
                            })
                            .catch((error) => {
                                console.error(`Error sending notification to ${doc.id}: `, error);
                            })
                    );
                }
            });

            await Promise.all(promises);
            console.log("All notifications sent successfully.");
        } catch (error) {
            console.error("Error sending notifications: ", error);
        }
    });
