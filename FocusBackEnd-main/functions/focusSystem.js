import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

/* Main function to check task completion and award points based on collection/pillar-------------------------*/

async function checkTaskCompletion(event, db) {
  const collectionID = event.document.split("/")[0];
  const taskData = event.data.after.data();
  const { userID } = taskData;
  const userRef = db.collection("users").doc(userID);

  try {
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      logger.error("User document does not exist:", userID);
      return;
    }

    switch (collectionID) {
      case "physicality_objectives":
        await handlePhysicalityObjectives(taskData, userRef, event);
        break;
      case "mindfulness_objectives":
        await handleMindfulnessObjectives(taskData, userRef, event);
        break;
      case "profession_objectives":
        await handleProfessionObjectives(taskData, userRef, event, db);
        break;
      default:
        logger.error("Unknown collection ID:", collectionID);
        break;
    }
  } catch (error) {
    logger.error(`Error updating task completion for user ${userID}:`, error);
  }

  return null;
}

/*------------------------------------------------------------------------------------------------------------*/

/*Functions to handle task completion for each pillar---------------------------------------------------------*/

// Handles physicality objectives, awarding points based on task completion
async function handlePhysicalityObjectives(taskData, userRef, event) {
  const { progress, goal, isAchieved, title, calorieStrategy } = taskData;
  const userDoc = await userRef.get();
  const userData = userDoc.data();
  const { accountCreationTime } = userData;
  const dayOfWeek = accountCreationTime.toDate().getDay();
  const date = new Date();
  const daysSinceCreation = Math.floor(
    (date - accountCreationTime.toDate()) / (1000 * 60 * 60 * 24)
  );
  let points = 0;
  let margin = 300;
  let calorieMinimum = 1500;
  let modifiedGoal = goal;

  // Adjust goal if the user is in their first week
  if (daysSinceCreation < 7) {
    switch (dayOfWeek) {
      case 3: // Wednesday
      case 4: // Thursday
        modifiedGoal = Math.floor(goal * 0.4);
        break;
      case 5: // Friday
      case 6: // Saturday
        modifiedGoal = Math.floor(goal * 0.2);
        break;
      case 0: // Sunday
        modifiedGoal = Math.floor(goal * 0.1);
        break;
      default:
        // No changes for Monday (1) and Tuesday (2)
        break;
    }
  }

  try {
    if (title === "Track Calories") {
      switch (calorieStrategy) {
        case "Maintain":
          if (
            progress <= modifiedGoal + margin &&
            progress >= modifiedGoal - margin &&
            !isAchieved
          ) {
            points = 3; // Award points for achieving the goal
          }
          break;

        case "Bulk":
          if (progress >= modifiedGoal && !isAchieved) {
            points = 3; // Award points for achieving the goal
          }
          break;

        case "Cut":
          if (
            progress <= modifiedGoal &&
            progress >= calorieMinimum &&
            !isAchieved
          ) {
            points = 3; // Award points for achieving the goal
          }
          break;

        default:
          logger.error(`Unknown calorie strategy: ${calorieStrategy}`);
          break;
      }
    } else {
      if (progress >= modifiedGoal && !isAchieved) {
        points = 3; // Award points for achieving the general goal
      }
    }

    if (points > 0) {
      // Increment the points in the database
      await userRef.update({
        physicalityPoints: FieldValue.increment(points),
      });
      logger.info(
        `User ${userRef.id} awarded ${points} points for physicality objective.`
      );

      // Re-fetch the updated user document after the points update
      const updatedUserDoc = await userRef.get();
      const updatedUserData = updatedUserDoc.data();

      // Update isAchieved status in the task document
      await event.data.after.ref.update({ isAchieved: true });
      logger.info(`Task marked as achieved for user ${userRef.id}.`);

      // Use the updated user data to calculate the new ratings
      await updatePillarRating(userRef, updatedUserData, "physicality");
      await updateFocusRating(userRef, updatedUserData);
    }
  } catch (error) {
    logger.error(
      `Error updating physicality points or isAchieved for user ${userRef.id}:`,
      error
    );
  }
}

// Handles mindfulness objectives, awarding points based on task completion
async function handleMindfulnessObjectives(taskData, userRef, event) {
  const { progress, goal, isAchieved } = taskData;
  const userDoc = await userRef.get();
  const userData = userDoc.data();
  const { accountCreationTime } = userData;
  const dayOfWeek = accountCreationTime.toDate().getDay();
  const date = new Date();
  const daysSinceCreation = Math.floor(
    (date - accountCreationTime.toDate()) / (1000 * 60 * 60 * 24)
  );
  let points = 0;
  let modifiedGoal = goal;

  // Adjust goal if the user is in their first week
  if (daysSinceCreation < 7) {
    switch (dayOfWeek) {
      case 3: // Wednesday
      case 4: // Thursday
        modifiedGoal = Math.floor(goal * 0.4);
        break;
      case 5: // Friday
      case 6: // Saturday
        modifiedGoal = Math.floor(goal * 0.2);
        break;
      case 0: // Sunday
        modifiedGoal = Math.floor(goal * 0.1);
        break;
      default:
        // No changes for Monday (1) and Tuesday (2)
        break;
    }
  }

  if (progress >= modifiedGoal && !isAchieved) {
    points = 3;

    try {
      // Increment the points in the database
      await userRef.update({
        mindfulnessPoints: FieldValue.increment(points),
      });
      logger.info(
        `User ${userRef.id} awarded ${points} points for mindfulness objective.`
      );

      // Re-fetch the updated user document after the points update
      const updatedUserDoc = await userRef.get();
      const updatedUserData = updatedUserDoc.data();

      // Update isAchieved status in the task document
      await event.data.after.ref.update({ isAchieved: true });
      logger.info(`Task marked as achieved for user ${userRef.id}.`);

      // Use the updated user data to calculate the new ratings
      await updatePillarRating(userRef, updatedUserData, "mindfulness");
      await updateFocusRating(userRef, updatedUserData);
    } catch (error) {
      logger.error(
        `Error updating mindfulness points or isAchieved for user ${userRef.id}:`,
        error
      );
    }
  }
}

// Handles profession objectives, awarding points based on task completion and deadline
async function handleProfessionObjectives(taskData, userRef, event, db) {
  const { checkOffTime, time, creationTime } = taskData;
  const taskID = event.params.taskID;
  const now = new Date();
  const cap = 15; // Maximum points that can be awarded daily
  let pointsToAward = 0;

  try {
    // Fetch the user document to get current points
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      logger.error(`User ${userRef.id} does not exist.`);
    }

    const userData = userDoc.data();
    let dailyProfessionPoints = userData.dailyProfessionPoints || 0;
    let professionPoints = userData.professionPoints || 0;

    if (time && checkOffTime) {
      if (now > time.toDate()) {
        // Task passed the deadline, apply decay
        const decayPoints = await calculateDecayPoints(userRef, "profession"); // Should be negative

        // Apply decay to professionPoints and dailyProfessionPoints
        professionPoints = Math.max(professionPoints + decayPoints, 0);
        dailyProfessionPoints = Math.max(
          dailyProfessionPoints + decayPoints,
          0
        );

        // Update professionPoints and dailyProfessionPoints directly
        await userRef.update({
          professionPoints: professionPoints,
          dailyProfessionPoints: dailyProfessionPoints,
        });

        logger.info(
          `Task ${taskID} for user ${userRef.id} passed deadline, applying decay. New professionPoints: ${professionPoints}, New dailyProfessionPoints: ${dailyProfessionPoints}`
        );

        await deleteProfessionTask(taskID, db);
      } else if (checkOffTime.toDate() > creationTime.toDate()) {
        // Task completed before deadline, assign full points with daily cap
        const remainingCap = cap - dailyProfessionPoints;
        if (remainingCap > 0) {
          pointsToAward = Math.min(4, remainingCap);

          // Update points
          await userRef.update({
            professionPoints: FieldValue.increment(pointsToAward),
            dailyProfessionPoints: FieldValue.increment(pointsToAward),
          });

          logger.info(
            `Task ${taskID} for user ${userRef.id} completed before deadline. Awarded ${pointsToAward} points.`
          );
        } else {
          logger.info(
            `Task ${taskID} for user ${userRef.id} completed before deadline. Daily cap reached. No points awarded.`
          );
        }

        await deleteProfessionTask(taskID, db);
      }
    } else if (!time && checkOffTime) {
      // No deadline, assign partial points with daily cap
      const remainingCap = cap - dailyProfessionPoints;
      if (remainingCap > 0) {
        pointsToAward = Math.min(2, remainingCap);

        // Update points
        await userRef.update({
          professionPoints: FieldValue.increment(pointsToAward),
          dailyProfessionPoints: FieldValue.increment(pointsToAward),
        });

        logger.info(
          `Task ${taskID} for user ${userRef.id} has no deadline, awarding ${pointsToAward} points.`
        );
      } else {
        logger.info(
          `Task ${taskID} for user ${userRef.id} has no deadline, but daily cap reached. No points awarded.`
        );
      }

      await deleteProfessionTask(taskID, db);
    }

    // Re-fetch the updated user document after the points update
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();

    // Use the updated user data to calculate the new ratings
    await updatePillarRating(userRef, updatedUserData, "profession");
    await updateFocusRating(userRef, updatedUserData);
  } catch (error) {
    logger.error(
      `Error updating profession points or handling task ${taskID} for user ${userRef.id}:`,
      error
    );
  }
}

/*------------------------------------------------------------------------------------------------------------*/

/*Function for updating fields--------------------------------------------------------------------------------*/

// Update the user's pillar ratings based on the total points they have earned
async function updatePillarRating(userRef, userData, pillar) {
  const { physicalityPoints, mindfulnessPoints, professionPoints } = userData;

  let physicalityRating = userData.physicalityRating;
  let mindfulnessRating = userData.mindfulnessRating;
  let professionRating = userData.professionRating;
  let updateData = {};

  try {
    // Calculate the ratings for specific pillar
    switch (pillar) {
      case "physicality":
        physicalityRating = await calculateCurrentRating(
          physicalityPoints,
          physicalityRating
        );
        const physicalityPointsToLevelUp = await calculatePointsToLevelUp(
          physicalityRating
        );
        if (
          physicalityRating !== undefined &&
          physicalityPointsToLevelUp !== undefined
        ) {
          updateData.physicalityRating = physicalityRating;
          updateData.physicalityPointsToLevelUp = physicalityPointsToLevelUp;
        }
        break;
      case "mindfulness":
        mindfulnessRating = await calculateCurrentRating(
          mindfulnessPoints,
          mindfulnessRating
        );
        const mindfulnessPointsToLevelUp = await calculatePointsToLevelUp(
          mindfulnessRating
        );
        if (
          mindfulnessRating !== undefined &&
          mindfulnessPointsToLevelUp !== undefined
        ) {
          updateData.mindfulnessRating = mindfulnessRating;
          updateData.mindfulnessPointsToLevelUp = mindfulnessPointsToLevelUp;
        }
        break;
      case "profession":
        professionRating = await calculateCurrentRating(
          professionPoints,
          professionRating
        );
        const professionPointsToLevelUp = await calculatePointsToLevelUp(
          professionRating
        );
        if (
          professionRating !== undefined &&
          professionPointsToLevelUp !== undefined
        ) {
          updateData.professionRating = professionRating;
          updateData.professionPointsToLevelUp = professionPointsToLevelUp;
        }
        break;
      default:
        logger.error(`Invalid pillar: ${pillar}`);
    }

    // Update the user's document with the new ratings and points to level up
    if (Object.keys(updateData).length > 0) {
      await userRef.update(updateData);
      logger.info(
        `Pillar ratings and points to level up updated for user ${userRef.id}:`,
        updateData
      );
    }
  } catch (error) {
    logger.error(
      `Error updating pillar ratings for user ${userRef.id}:`,
      error
    );
  }
}

// Update the user's focus rating based on the average of the three pillar ratings
async function updateFocusRating(userRef, userData) {
  const { physicalityRating, mindfulnessRating, professionRating } = userData;
  const newRating =
    (physicalityRating + mindfulnessRating + professionRating) / 3;
  await userRef.update({
    focusRating: newRating,
  });
}

// Reset task progress to 0 and isAchieved to false
async function resetTaskProgress(collectionID, taskID, db) {
  const taskRef = db.collection(collectionID).doc(taskID);
  await taskRef.update({
    progress: 0,
    isAchieved: false,
  });
}

async function deleteProfessionTask(taskID, db) {
  const taskRef = db.collection("profession_objectives").doc(taskID);
  await taskRef.delete();
}

/*------------------------------------------------------------------------------------------------------------*/

/*Helper functions to carry out calculations needed-----------------------------------------------------------*/

// Calculates decay points based on a specific pillar's rating
async function calculateDecayPoints(userRef, pillar) {
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  let pillarRating;
  switch (pillar) {
    case "physicality":
      pillarRating = userData.physicalityRating;
      break;
    case "mindfulness":
      pillarRating = userData.mindfulnessRating;
      break;
    case "profession":
      pillarRating = userData.professionRating;
      break;
    default:
      logger.error(`Invalid pillar for decay: ${pillar}`);
      return 0;
  }

  let decayValue;

  if (pillarRating < 60) {
    decayValue = -2;
  } else {
    decayValue = -1 * (Math.floor((pillarRating - 50) / 10) + 2);
  }

  return decayValue;
}

// Calculates points needed to level up based on a pillar's current rating
async function calculatePointsToLevelUp(pillarRating) {
  let pointsToLevelUp;

  if (pillarRating <= 50) {
    pointsToLevelUp = 10;
  } else if (pillarRating > 50 && pillarRating < 60) {
    pointsToLevelUp = 2 * (pillarRating - 50) + 10;
  } else {
    // Exponential increase for levels 60 and above with a dynamic multiplier
    let basePointsToLevelUp = 2 * (60 - 50) + 10; // Calculate points for level 60 as base
    pointsToLevelUp = basePointsToLevelUp;
    for (let i = 60; i <= pillarRating; i++) {
      // Use a dynamic multiplier that increases with the pillar rating
      let multiplier = 1.1 + (i - 60) * 0.05; // Adjust this formula as needed
      pointsToLevelUp = Math.ceil(pointsToLevelUp * multiplier);
    }
  }

  return pointsToLevelUp;
}

// Calculates current pillar rating user should be at based on total points and points needed to level up/down
async function calculateCurrentRating(totalPoints, pillarRating) {
  let level = pillarRating;

  // Loop for incrementing the level if totalPoints are sufficient for the next level
  while (true) {
    let pointsRequired = await calculatePointsToLevelUp(level);
    logger.info(`Points required for level ${level}: ${pointsRequired}`);
    logger.info(`Total points: ${totalPoints}`);

    // If totalPoints are sufficient for the next level, increment the level
    if (totalPoints >= pointsRequired) {
      level++;
      if (level > 99) {
        level = 99;
        break;
      }
    } else {
      // If not enough points for the next level, break the loop
      break;
    }
  }

  // Loop for decrementing the level if totalPoints are not enough for the current level
  while (level > 50) {
    let previousPointsToLevelUp = await calculatePointsToLevelUp(level - 1);

    // If totalPoints are not enough for the current level, decrement the level
    if (totalPoints < previousPointsToLevelUp) {
      level--;
    } else {
      // If enough points for the current level, break the loop
      break;
    }
  }

  return level;
}

/*------------------------------------------------------------------------------------------------------------*/

/*Scheduled functions to apply decay points and reset task progress------------------------------------------------------*/

async function applyDailyDecayPoints(db) {
  try {
    const collections = ["physicality_objectives", "mindfulness_objectives"];
    for (const collection of collections) {
      const snapshot = await db
        .collection(collection)
        .where("frequency", "==", "per day")
        .where("isAchieved", "==", false)
        .get();
      for (const doc of snapshot.docs) {
        const taskData = doc.data();
        const userRef = db.collection("users").doc(taskData.userID);

        const points = await calculateDecayPoints(
          userRef,
          collection === "physicality_objectives"
            ? "physicality"
            : "mindfulness"
        );

        // Apply points but ensure they don't go below 0
        const updatedUserDoc = await userRef.get();
        const updatedUserData = updatedUserDoc.data();
        const currentPoints =
          collection === "physicality_objectives"
            ? updatedUserData.physicalityPoints
            : updatedUserData.mindfulnessPoints;
        const newPoints = Math.max(currentPoints + points, 0);

        await userRef.update({
          [collection === "physicality_objectives"
            ? "physicalityPoints"
            : "mindfulnessPoints"]: newPoints,
        });
        logger.info(
          `Decay points applied to user ${taskData.userID} for task ${doc.id}`
        );
      }
    }
  } catch (error) {
    logger.error("Error applying daily decay points:", error);
  }
}

async function applyWeeklyDecayPoints(db) {
  try {
    const collections = ["physicality_objectives", "mindfulness_objectives"];
    for (const collection of collections) {
      const snapshot = await db
        .collection(collection)
        .where("frequency", "==", "per week")
        .where("isAchieved", "==", false)
        .get();
      for (const doc of snapshot.docs) {
        const taskData = doc.data();
        const userRef = db.collection("users").doc(taskData.userID);

        const points = await calculateDecayPoints(
          userRef,
          collection === "physicality_objectives"
            ? "physicality"
            : "mindfulness"
        );

        // Apply points but ensure they don't go below 0
        const updatedUserDoc = await userRef.get();
        const updatedUserData = updatedUserDoc.data();
        const currentPoints =
          collection === "physicality_objectives"
            ? updatedUserData.physicalityPoints
            : updatedUserData.mindfulnessPoints;
        const newPoints = Math.max(currentPoints + points, 0);

        await userRef.update({
          [collection === "physicality_objectives"
            ? "physicalityPoints"
            : "mindfulnessPoints"]: newPoints,
        });
        logger.info(
          `Decay points applied to user ${taskData.userID} for task ${doc.id}`
        );
      }
    }
  } catch (error) {
    logger.error("Error applying weekly decay points:", error);
  }
}

async function resetDailyTasks(db) {
  try {
    const collections = ["physicality_objectives", "mindfulness_objectives"];
    for (const collection of collections) {
      const snapshot = await db
        .collection(collection)
        .where("frequency", "==", "per day")
        .get();
      for (const doc of snapshot.docs) {
        await resetTaskProgress(collection, doc.id, db);
      }
    }
    logger.info("daily tasks progress reset completed.");
  } catch (error) {
    logger.error("Error resetting daily tasks:", error);
  }
}

async function resetWeeklyTasks(db) {
  try {
    const collections = ["physicality_objectives", "mindfulness_objectives"];
    for (const collection of collections) {
      const snapshot = await db
        .collection(collection)
        .where("frequency", "==", "per week")
        .get();
      for (const doc of snapshot.docs) {
        await resetTaskProgress(collection, doc.id, db);
      }
    }
    logger.info("Weekly tasks progress reset completed.");
  } catch (error) {
    logger.error("Error resetting weekly tasks:", error);
  }
}

// Function to ensure processing order of daily functions is correct and progress not reset prematurely
async function handleDailyFunctions(db) {
  try {
    // Apply decay points
    await applyDailyDecayPoints(db);

    // Reset task progress
    await resetDailyTasks(db);

    logger.info("Decay applied and daily tasks reset completed.");
  } catch (error) {
    logger.error("Error applying decay and resetting daily tasks:", error);
  }
}

// Function to ensure processing order of weekly functions is correct and progress not reset prematurely
async function handleWeeklyFunctions(db) {
  try {
    // Apply decay points
    await applyWeeklyDecayPoints(db);

    // Reset task progress
    await resetWeeklyTasks(db);

    logger.info("Decay applied and weekly tasks reset completed.");
  } catch (error) {
    logger.error("Error applying decay and resetting weekly tasks:", error);
  }
}

/*------------------------------------------------------------------------------------------------------------*/

export default {
  calculatePointsToLevelUp,
  calculateCurrentRating,
  calculateDecayPoints,
  handlePhysicalityObjectives,
  handleMindfulnessObjectives,
  handleProfessionObjectives,
  updatePillarRating,
  updateFocusRating,
  checkTaskCompletion,
  applyDailyDecayPoints,
  applyWeeklyDecayPoints,
  resetDailyTasks,
  resetWeeklyTasks,
  handleDailyFunctions,
  handleWeeklyFunctions,
};
