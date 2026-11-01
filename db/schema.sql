-- FitFuel database schema
-- Core tables follow the system specification exactly.
-- Supporting tables are extensions to the draft ERD (see README).
-- SQL is kept standard so it can move to MySQL later
-- (in MySQL, add AUTO_INCREMENT to each INTEGER PRIMARY KEY).

-- ============ Core tables ============

-- Accounts component (Muin)
CREATE TABLE IF NOT EXISTS Users (
  UserID       INTEGER PRIMARY KEY,
  FullName     VARCHAR(50)  NOT NULL,
  Email        VARCHAR(100) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  WeeklyBudget DECIMAL(6,2) DEFAULT 0,
  IsActive     BOOLEAN      DEFAULT 1,
  DateJoined   DATE         DEFAULT (CURRENT_DATE)
);

-- Recipes & Meal Planning component (Albina)
CREATE TABLE IF NOT EXISTS Recipes (
  RecipeID        INTEGER PRIMARY KEY,
  RecipeName      VARCHAR(80)  NOT NULL,
  MealType        VARCHAR(20)  CHECK (MealType IN ('breakfast', 'lunch', 'dinner', 'snack')),
  PricePerPortion DECIMAL(5,2) NOT NULL,
  Calories        INTEGER      NOT NULL,
  IsVegetarian    BOOLEAN      DEFAULT 0,
  DateAdded       DATE         DEFAULT (CURRENT_DATE)
);

-- Workouts & Progress component (Priyanka)
CREATE TABLE IF NOT EXISTS Workouts (
  WorkoutID          INTEGER PRIMARY KEY,
  WorkoutName        VARCHAR(60) NOT NULL,
  Goal               VARCHAR(30) CHECK (Goal IN ('lose weight', 'build muscle', 'stay healthy')),
  Difficulty         VARCHAR(15) CHECK (Difficulty IN ('easy', 'medium', 'hard')),
  DurationMinutes    INTEGER     NOT NULL,
  IsBeginnerFriendly BOOLEAN     DEFAULT 0,
  DateCreated        DATE        DEFAULT (CURRENT_DATE)
);

-- Linking table Users <-> Recipes
CREATE TABLE IF NOT EXISTS MealPlanEntry (
  EntryID  INTEGER PRIMARY KEY,
  UserID   INTEGER NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
  RecipeID INTEGER NOT NULL REFERENCES Recipes(RecipeID) ON DELETE CASCADE,
  PlanDate DATE    NOT NULL,
  MealSlot VARCHAR(10) CHECK (MealSlot IN ('lunch', 'dinner'))
);

-- Linking table Users <-> Workouts
CREATE TABLE IF NOT EXISTS WorkoutLog (
  LogID       INTEGER PRIMARY KEY,
  UserID      INTEGER NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
  WorkoutID   INTEGER NOT NULL REFERENCES Workouts(WorkoutID) ON DELETE CASCADE,
  LogDate     DATE    NOT NULL,
  IsCompleted BOOLEAN DEFAULT 0
);

-- ============ Supporting tables ============

-- One row per student: goal, diet, reminder day and training days per week
CREATE TABLE IF NOT EXISTS UserProfile (
  ProfileID    INTEGER PRIMARY KEY,
  UserID       INTEGER NOT NULL UNIQUE REFERENCES Users(UserID) ON DELETE CASCADE,
  Goal         VARCHAR(30) CHECK (Goal IN ('lose weight', 'build muscle', 'stay healthy')),
  DietType     VARCHAR(20) DEFAULT 'none' CHECK (DietType IN ('none', 'vegetarian', 'vegan', 'halal')),
  ReminderDay  VARCHAR(10) CHECK (ReminderDay IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  TrainingDays INTEGER     CHECK (TrainingDays BETWEEN 2 AND 5)
);

CREATE TABLE IF NOT EXISTS Admins (
  AdminID      INTEGER PRIMARY KEY,
  Username     VARCHAR(50)  NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL
);

-- Ingredients for ONE portion of a recipe
CREATE TABLE IF NOT EXISTS RecipeIngredient (
  RecipeIngredientID INTEGER PRIMARY KEY,
  RecipeID           INTEGER NOT NULL REFERENCES Recipes(RecipeID) ON DELETE CASCADE,
  IngredientName     VARCHAR(60)  NOT NULL,
  Quantity           DECIMAL(6,2) NOT NULL,
  Unit               VARCHAR(15)  NOT NULL,
  Cost               DECIMAL(5,2) NOT NULL
);

-- Vegan / halal tags (vegetarian uses Recipes.IsVegetarian)
CREATE TABLE IF NOT EXISTS RecipeDietTag (
  RecipeID INTEGER     NOT NULL REFERENCES Recipes(RecipeID) ON DELETE CASCADE,
  DietType VARCHAR(20) NOT NULL CHECK (DietType IN ('vegan', 'halal')),
  PRIMARY KEY (RecipeID, DietType)
);

CREATE TABLE IF NOT EXISTS RecipeStep (
  StepID      INTEGER PRIMARY KEY,
  RecipeID    INTEGER      NOT NULL REFERENCES Recipes(RecipeID) ON DELETE CASCADE,
  StepNumber  INTEGER      NOT NULL,
  Instruction VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS WorkoutExercise (
  ExerciseID   INTEGER PRIMARY KEY,
  WorkoutID    INTEGER      NOT NULL REFERENCES Workouts(WorkoutID) ON DELETE CASCADE,
  ExerciseName VARCHAR(60)  NOT NULL,
  Sets         INTEGER      NOT NULL,
  Reps         INTEGER      NOT NULL,
  Instructions VARCHAR(255),
  MediaURL     VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS WeightLog (
  WeightLogID INTEGER PRIMARY KEY,
  UserID      INTEGER      NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
  WeightKg    DECIMAL(5,2) NOT NULL,
  LogDate     DATE         NOT NULL
);

CREATE TABLE IF NOT EXISTS FavouriteRecipe (
  UserID    INTEGER NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
  RecipeID  INTEGER NOT NULL REFERENCES Recipes(RecipeID) ON DELETE CASCADE,
  DateSaved DATE    DEFAULT (CURRENT_DATE),
  PRIMARY KEY (UserID, RecipeID)
);

CREATE TABLE IF NOT EXISTS ShoppingCheck (
  UserID         INTEGER     NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
  WeekStart      DATE        NOT NULL,
  IngredientName VARCHAR(60) NOT NULL,
  IsChecked      BOOLEAN     DEFAULT 0,
  PRIMARY KEY (UserID, WeekStart, IngredientName)
);
