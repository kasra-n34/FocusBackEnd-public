import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";

async function handleMotivationMessages() {
  let message = {
    notification: {
      title: "Motivation",
      body: getRandomMotivationalQuote(),
    },
    topic: "motivation",
  };

  try {
    const response = await getMessaging().send(message);
    logger.info(`Successfully sent message for topic motivation:`, response);
  } catch (error) {
    logger.error(`Error sending message for topic motivation:`, error);
  }
}

async function handleProfileUpdates(event, db) {

  const afterData = event.data.after.data();
  const { profileUpdateNotifications } = afterData;
  
  if (!profileUpdateNotifications) {
    return;
  }

  const beforeData = event.data.before.data();
  const userID = event.params.userID;
  const userRef = db.collection("users").doc(userID);
  const userDoc = await userRef.get();
  const fcmToken = userDoc.data().fcmToken;

  const affectedRatings = [];

  // Check for decreases in physicality rating
  if (beforeData.physicalityRating - afterData.physicalityRating >= 1) {
    affectedRatings.push('Physicality');
  }

  // Check for decreases in mindfulness rating
  if (beforeData.mindfulnessRating - afterData.mindfulnessRating >= 1) {
    affectedRatings.push('Mindfulness');
  }

  // Check for decreases in profession rating
  if (beforeData.professionRating - afterData.professionRating >= 1) {
    affectedRatings.push('Profession');
  }

  // Check for decreases in focus rating
  if (beforeData.focusRating - afterData.focusRating >= 1) {
    affectedRatings.push('Focus');
  }

  let notificationMessage = '';
  if (affectedRatings.length === 1) {
    notificationMessage = `Your ${affectedRatings[0]} rating has decreased.`;
  } else if (affectedRatings.length === 2) {
    notificationMessage = `Your ${affectedRatings[0]} and ${affectedRatings[1]} ratings have decreased.`;
  } else if (affectedRatings.length > 2) {
    notificationMessage = `Your ${affectedRatings.slice(0, -1).join(', ')} and ${affectedRatings.slice(-1)} ratings have decreased.`;
  }


  // Send notification if any changes detected
  if (notificationMessage) {
    const message = {
      notification: {
        title: "Rating Decrease Alert",
        body: notificationMessage,
      },
      token: fcmToken,
    };

    try {
      const response = await getMessaging().send(message);
      logger.info(`Successfully sent rating decrease notification:`, response);
    } catch (error) {
      logger.error(`Error sending rating decrease notification:`, error);
    }
  }
}

async function handleFriendRequests(event, db) {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  const oldRequests = beforeData.received_friend_requests || [];
  const newRequests = afterData.received_friend_requests || [];

  // Find any new friend requests (added to the array)
  const addedRequests = newRequests.filter(
    (request) => !oldRequests.includes(request)
  );

  if (addedRequests.length > 0) {
    const senderID = addedRequests[0]; // Get the latest added friend request
    const senderDoc = await db.collection("users").doc(senderID).get();
    const senderName = senderDoc.data().fullname;

    const userID = event.params.userID;
    const userDoc = await db.collection("users").doc(userID).get();
    const fcmToken = userDoc.data().fcmToken;

    const message = {
      notification: {
        title: "New Friend Request",
        body: `${senderName} has sent you a friend request.`,
      },
      token: fcmToken,
    };

    try {
      const response = await getMessaging().send(message);
      logger.info(
        `Successfully sent message for new friend request:`,
        response
      );
    } catch (error) {
      logger.error(`Error sending message for new friend request:`, error);
    }
  }
}

async function handleFriendAcceptance(event, db) {
  const userID = event.params.userID;
  const userDoc = await db.collection("users").doc(userID).get();
  const fcmToken = userDoc.data().fcmToken;

  const friendID = event.params.friendID;
  const friendDoc = await db.collection("users").doc(friendID).get();
  const friendName = friendDoc.data().fullname;

  const message = {
    notification: {
      title: "Friend Request Accepted",
      body: `${friendName} has accepted your friend request.`,
    },
    token: fcmToken,
  };

  try {
    const response = await getMessaging().send(message);
    logger.info(`Successfully sent message for new friend accepted:`, response);
  } catch (error) {
    logger.error(`Error sending message for new friend accepted:`, error);
  }
}

const motivationalQuotes = [
  "Believe you can and you're halfway there.",
  "Success is not final, failure is not fatal: It is the courage to continue that counts.",
  "Don't watch the clock; do what it does. Keep going.",
  "The only way to do great work is to love what you do.",
  "Act as if what you do makes a difference. It does.",
  "You are never too old to set another goal or to dream a new dream.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big days.",
  "It's going to be hard, but hard does not mean impossible.",
  "Don't wait for opportunity. Create it.",
  "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
  "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle.",
  "Challenges are what make life interesting. Overcoming them is what makes life meaningful.",
  "The only limit to our realization of tomorrow is our doubts of today.",
  "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.",
  "You are braver than you believe, stronger than you seem, and smarter than you think.",
  "What you get by achieving your goals is not as important as what you become by achieving your goals.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "The only place where success comes before work is in the dictionary.",
  "If you want to achieve greatness stop asking for permission.",
  "Great things are done by a series of small things brought together.",
  "Your life does not get better by chance, it gets better by change.",
  "If you can dream it, you can do it.",
  "The best way to predict your future is to create it.",
  "Keep your face always toward the sunshine—and shadows will fall behind you.",
  "Don't count the days, make the days count.",
  "Success is how high you bounce when you hit bottom.",
  "Courage is resistance to fear, mastery of fear—not absence of fear.",
  "Success is not the key to happiness. Happiness is the key to success. If you love what you are doing, you will be successful.",
  "Don't let what you cannot do interfere with what you can do.",
  "It's not whether you get knocked down, it's whether you get up.",
  "You miss 100% of the shots you don't take.",
  "The only way to achieve the impossible is to believe it is possible.",
  "Believe in the magic of beginnings.",
  "Your time is limited, don't waste it living someone else's life.",
  "You have within you right now, everything you need to deal with whatever the world can throw at you.",
  "The secret of getting ahead is getting started.",
  "Failure will never overtake me if my determination to succeed is strong enough.",
  "We may encounter many defeats but we must not be defeated.",
  "To accomplish great things, we must not only act, but also dream, not only plan, but also believe.",
  "Hardships often prepare ordinary people for an extraordinary destiny.",
  "The only person you are destined to become is the person you decide to be.",
  "Start where you are. Use what you have. Do what you can.",
  "The only thing standing between you and your goal is the story you keep telling yourself as to why you can't achieve it.",
  "It does not matter how slowly you go as long as you do not stop.",
  "With the new day comes new strength and new thoughts.",
  "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
];

function getRandomMotivationalQuote() {
  const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
  return motivationalQuotes[randomIndex];
}

export default {
  handleMotivationMessages,
  handleProfileUpdates,
  handleFriendRequests,
  handleFriendAcceptance,
};
