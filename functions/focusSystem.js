const { logger } = require("firebase-functions");
const { FieldValue, getFirestore} = require("firebase-admin/firestore");

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


// Handles physicality objectives

const db = getFirestore(); // Use the initialized Firestore instance

// Handles physicality objectives
async function handlePhysicalityObjectives(taskData, userRef, event) {
  const { progress, goal, isAchieved, title, calorieStrategy } = taskData;
  const date = new Date();
  let points = 0;
  let margin = 300;
  let calorieMinimum = 1500;
  let modifiedGoal = goal;

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        logger.error(`User ${userRef.id} does not exist.`);
        return;
      }

      const updatedTaskDoc = await transaction.get(event.data.after.ref);
      if (updatedTaskDoc.data().isAchieved) {
        logger.info(`Task already marked as achieved for user ${userRef.id}, skipping.`);
        return;
      }

      // Adjust goal in the first week based on account creation day
      const userData = userDoc.data();
      const accountCreationTime = userData.accountCreationTime.toDate();
      const daysSinceCreation = Math.floor((date - accountCreationTime) / (1000 * 60 * 60 * 24));
      if (daysSinceCreation < 7) {
        const dayOfWeek = accountCreationTime.getDay();
        switch (dayOfWeek) {
          case 3: case 4: modifiedGoal = Math.floor(goal * 0.4); break;
          case 5: case 6: modifiedGoal = Math.floor(goal * 0.2); break;
          case 0: modifiedGoal = Math.floor(goal * 0.1); break;
        }
      }

      // Award points based on strategy
      if (title === "Track Calories") {
        switch (calorieStrategy) {
          case "Maintain":
            if (progress <= modifiedGoal + margin && progress >= modifiedGoal - margin) points = 3;
            break;
          case "Bulk":
            if (progress >= modifiedGoal) points = 3;
            break;
          case "Cut":
            if (progress <= modifiedGoal && progress >= calorieMinimum) points = 3;
            break;
          default:
            logger.error(`Unknown calorie strategy: ${calorieStrategy}`);
        }
      } else {
        if (progress >= modifiedGoal) points = 3;
      }

      if (points > 0) {
        transaction.update(userRef, {
          physicalityPoints: FieldValue.increment(points),
        });
        transaction.update(event.data.after.ref, { isAchieved: true });
        logger.info(`User ${userRef.id} awarded ${points} points for physicality objective.`);
      }
    });

    // Fetch updated data and update ratings
    const updatedUserDoc = await userRef.get();
    await updatePillarRating(userRef, updatedUserDoc.data(), "physicality");
    await updateFocusRating(userRef, updatedUserDoc.data());

  } catch (error) {
    logger.error(`Error updating physicality points for user ${userRef.id}:`, error);
  }
}

// Handles mindfulness objectives
async function handleMindfulnessObjectives(taskData, userRef, event) {
  const { progress, goal, isAchieved } = taskData;
  const date = new Date();
  let points = 0;
  let modifiedGoal = goal;

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        logger.error(`User ${userRef.id} does not exist.`);
        return;
      }

      const updatedTaskDoc = await transaction.get(event.data.after.ref);
      if (updatedTaskDoc.data().isAchieved) {
        logger.info(`Task already marked as achieved for user ${userRef.id}, skipping.`);
        return;
      }

      // Adjust goal in the first week based on account creation day
      const userData = userDoc.data();
      const accountCreationTime = userData.accountCreationTime.toDate();
      const daysSinceCreation = Math.floor((date - accountCreationTime) / (1000 * 60 * 60 * 24));
      if (daysSinceCreation < 7) {
        const dayOfWeek = accountCreationTime.getDay();
        switch (dayOfWeek) {
          case 3: case 4: modifiedGoal = Math.floor(goal * 0.4); break;
          case 5: case 6: modifiedGoal = Math.floor(goal * 0.2); break;
          case 0: modifiedGoal = Math.floor(goal * 0.1); break;
        }
      }

      if (progress >= modifiedGoal) {
        points = 3;
        transaction.update(userRef, {
          mindfulnessPoints: FieldValue.increment(points),
        });
        transaction.update(event.data.after.ref, { isAchieved: true });
        logger.info(`User ${userRef.id} awarded ${points} points for mindfulness objective.`);
      }
    });

    // Fetch updated data and update ratings
    const updatedUserDoc = await userRef.get();
    await updatePillarRating(userRef, updatedUserDoc.data(), "mindfulness");
    await updateFocusRating(userRef, updatedUserDoc.data());

  } catch (error) {
    logger.error(`Error updating mindfulness points for user ${userRef.id}:`, error);
  }
}

// Handles profession objectives
async function handleProfessionObjectives(taskData, userRef, event) {
  const { checkOffTime, time, creationTime } = taskData;
  const taskID = event.params.taskID;
  const now = new Date();
  const cap = 15;
  let pointsToAward = 0;

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        logger.error(`User ${userRef.id} does not exist.`);
        return;
      }

      const userData = userDoc.data();
      let dailyProfessionPoints = userData.dailyProfessionPoints || 0;
      let professionPoints = userData.professionPoints || 0;

      if (time && checkOffTime) {
        if (now > time.toDate()) {
          const decayPoints = await calculateDecayPoints(userRef, "profession");
          transaction.update(userRef, {
            professionPoints: Math.max(professionPoints + decayPoints, 0),
            dailyProfessionPoints: Math.max(dailyProfessionPoints + decayPoints, 0),
          });
          logger.info(`Task ${taskID} for user ${userRef.id} passed deadline, applying decay.`);
          await deleteProfessionTask(taskID, db);
        } else if (checkOffTime.toDate() > creationTime.toDate()) {
          const remainingCap = cap - dailyProfessionPoints;
          if (remainingCap > 0) {
            pointsToAward = Math.min(4, remainingCap);
            transaction.update(userRef, {
              professionPoints: FieldValue.increment(pointsToAward),
              dailyProfessionPoints: FieldValue.increment(pointsToAward),
            });
            logger.info(`Task ${taskID} for user ${userRef.id} completed before deadline, awarded ${pointsToAward} points.`);
          }
          await deleteProfessionTask(taskID, db);
        }
      } else if (!time && checkOffTime) {
        const remainingCap = cap - dailyProfessionPoints;
        if (remainingCap > 0) {
          pointsToAward = Math.min(2, remainingCap);
          transaction.update(userRef, {
            professionPoints: FieldValue.increment(pointsToAward),
            dailyProfessionPoints: FieldValue.increment(pointsToAward),
          });
          logger.info(`Task ${taskID} for user ${userRef.id} has no deadline, awarded ${pointsToAward} points.`);
        }
        await deleteProfessionTask(taskID, db);
      }
    });

    const updatedUserDoc = await userRef.get();
    await updatePillarRating(userRef, updatedUserDoc.data(), "profession");
    await updateFocusRating(userRef, updatedUserDoc.data());

  } catch (error) {
    logger.error(`Error updating profession points for user ${userRef.id}:`, error);
  }
}


/*------------------------------------------------------------------------------------------------------------*/

/*Function for updating fields--------------------------------------------------------------------------------*/

// Update the user's pillar ratings based on the total points they have earned


async function updatePillarRating(userRef, userData, pillar) {
  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        logger.error(`User ${userRef.id} does not exist.`);
        return;
      }

      const userData = userDoc.data(); // Get latest Firestore data
      let updateData = {};

      // Determine which pillar to update
      switch (pillar) {
        case "physicality":
          const newPhysicalityRating = await calculateCurrentRating(
            userData.physicalityPoints, // Use latest Firestore value
            userData.physicalityRating
          );

          if (newPhysicalityRating > userData.physicalityRating) {
            let level = userData.physicalityRating;
            let previousPointsToLevelUp = await calculatePointsToLevelUp(level);
            updateData.physicalityPoints = userData.physicalityPoints - previousPointsToLevelUp;
          }

          // Prevent unnecessary updates
          if (newPhysicalityRating !== userData.physicalityRating) {
            updateData.physicalityRating = newPhysicalityRating;
            updateData.physicalityPointsToLevelUp = await calculatePointsToLevelUp(newPhysicalityRating);
          } else {
            logger.info(`Skipping update: No change in physicality rating for user ${userRef.id}.`);
          }
          break;

        case "mindfulness":
          const newMindfulnessRating = await calculateCurrentRating(
            userData.mindfulnessPoints,
            userData.mindfulnessRating
          );

          if (newMindfulnessRating > userData.mindfulnessRating) {
            let level = userData.mindfulnessRating;
            let previousPointsToLevelUp = await calculatePointsToLevelUp(level);
            updateData.mindfulnessPoints = userData.mindfulnessPoints - previousPointsToLevelUp;
          }

          if (newMindfulnessRating !== userData.mindfulnessRating) {
            updateData.mindfulnessRating = newMindfulnessRating;
            updateData.mindfulnessPointsToLevelUp = await calculatePointsToLevelUp(newMindfulnessRating);
          } else {
            logger.info(`Skipping update: No change in mindfulness rating for user ${userRef.id}.`);
          }
          break;

        case "profession":
          const newProfessionRating = await calculateCurrentRating(
            userData.professionPoints,
            userData.professionRating
          );

          if (newProfessionRating > userData.professionRating) {
            let level = userData.professionRating;
            let previousPointsToLevelUp = await calculatePointsToLevelUp(level);
            updateData.professionPoints = userData.professionPoints - previousPointsToLevelUp;
          }

          if (newProfessionRating !== userData.professionRating) {
            updateData.professionRating = newProfessionRating;
            updateData.professionPointsToLevelUp = await calculatePointsToLevelUp(newProfessionRating);
          } else {
            logger.info(`Skipping update: No change in profession rating for user ${userRef.id}.`);
          }
          break;

        default:
          logger.error(`Invalid pillar: ${pillar}`);
          return;
      }

      // Prevent unnecessary Firestore updates
      if (Object.keys(updateData).length > 0) {
        transaction.update(userRef, updateData);
        logger.info(`Pillar ratings updated for user ${userRef.id}:`, updateData);
      } else {
        logger.info(`No changes needed for user ${userRef.id} on pillar ${pillar}.`);
      }
    });
  } catch (error) {
    logger.error(`Error updating pillar ratings for user ${userRef.id}:`, error);
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
  
    let pointsRequired = await calculatePointsToLevelUp(level);
    logger.info(`Points required for level ${level}: ${pointsRequired}`);
    logger.info(`Total points: ${totalPoints}`);

    // If totalPoints are sufficient for the next level, increment the level
    if (totalPoints >= pointsRequired) {
      level++;
      if (level > 99) {
        level = 99;
      }
    } 

  // Loop for decrementing the level if totalPoints are not enough for the current level
  if (level > 50) {
    let previousPointsToLevelUp = await calculatePointsToLevelUp(level - 1);

    // If totalPoints are not enough for the current level, decrement the level
    if (totalPoints < 0) {
      level--;
      totalPoints = previousPointsToLevelUp - totalPoints;
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

        const decayPoints = await calculateDecayPoints(
          userRef,
          collection === "physicality_objectives"
            ? "physicality"
            : "mindfulness"
        );

        // Apply decay points (rating will be lowered if its below zero by updatepillarrating)
        const updatedUserDoc = await userRef.get();
        const updatedUserData = updatedUserDoc.data();
        const currentPoints =
          collection === "physicality_objectives"
            ? updatedUserData.physicalityPoints
            : updatedUserData.mindfulnessPoints;
        const newPoints = currentPoints + decayPoints;

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

        const decayPoints = await calculateDecayPoints(
          userRef,
          collection === "physicality_objectives"
            ? "physicality"
            : "mindfulness"
        );

        // Apply decay points (rating will be lowered if its below zero by updatepillarrating)
        const updatedUserDoc = await userRef.get();
        const updatedUserData = updatedUserDoc.data();
        const currentPoints =
          collection === "physicality_objectives"
            ? updatedUserData.physicalityPoints
            : updatedUserData.mindfulnessPoints;
        const newPoints = currentPoints + decayPoints;

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

module.exports = {
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

