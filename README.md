# FitFuel

**Eat Healthy. Stay Active. Spend Wisely.**

FitFuel helps university students eat healthily and train regularly on a small budget. Students create an account, set a fitness goal, diet type and weekly food budget, get a weekly meal plan within their budget with an automatic shopping list, follow simple workout plans, log workouts and weight, and track their progress. An admin back end lets an administrator manage users, recipes and workouts.

University Agile team project by **The Agile Trio**.

## Team and component ownership

| Component | Owner | Back-end files |
|---|---|---|
| Accounts (sign up, login, profile, navigation, users admin) | **Muin Ahmed** (Scrum Master) | `routes/auth.js`, `routes/users.js`, `middleware/requireLogin.js` |
| Recipes & Meal Planning (recipes, meal plan, shopping list, recipes admin) | **Albina Rana** | `routes/recipes.js`, `routes/mealplans.js`, `utils/dietFilter.js` |
| Workouts & Progress (workouts, logs, weight, charts, workouts admin) | **Priyanka Pant** | `routes/workouts.js`, `routes/progress.js` (Sprint 3) |

Shared: `server.js`, `db/`, `utils/`, `public/css/style.css`, `public/js/api.js`, `public/js/nav.js`.

## Tech stack

- Front end: plain HTML, CSS and JavaScript (no frameworks, no CDNs; works offline)
- Back end: Node.js + Express
- Database: SQLite via `better-sqlite3`, plain standard SQL
- Auth: `express-session` (httpOnly cookie) + `bcrypt` (cost 10)
- Tests: `node:test` + `supertest`

## Install, run, seed and test

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env     # then set SESSION_SECRET to a long random string
npm start                # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm start` | Starts the server on port 3000 (or `PORT` from `.env`). On the very first start an empty database is filled with demo data automatically. |
| `npm run seed` | Deletes all data and recreates the database with demo data. |
| `npm test` | Runs all API tests against a fresh in-memory database (your real data is not touched). |

The database file is `db/fitfuel.db` (ignored by git). Without a `.env` file the app still starts, but uses a random session secret, so everyone is logged out on restart.

## Demo accounts

Demo data only – do not reuse these passwords anywhere.

| Role | Login | Password | Notes |
|---|---|---|---|
| Admin | `admin` | `Admin123!` | Admin pages arrive in Phase 4 |
| Student | `emma@example.com` | `Student123!` | Budget 300 kr, lose weight, vegetarian, has 6 weeks of weight and workout history |
| Student | `ali@example.com` | `Student123!` | Budget 450 kr, build muscle, halal |
| Student | `sofie@example.com` | `Student123!` | Budget 600 kr, stay healthy, vegan |

## Database schema

All tables are created by [`db/schema.sql`](db/schema.sql). Foreign keys are switched on (`PRAGMA foreign_keys = ON`). Every table that belongs to a user uses `ON DELETE CASCADE`, so deleting a user also deletes their meal plan, workout log, weight log, favourites, shopping ticks and profile. Allowed values (meal types, goals, difficulty, diet types, …) are enforced with `CHECK` constraints.

To move to MySQL later, add `AUTO_INCREMENT` to each `INTEGER PRIMARY KEY`; the rest is standard SQL.

### Core tables (as in the system specification)

**Users** (Accounts – Muin)

| Attribute | Type | Key / notes |
|---|---|---|
| UserID | INTEGER | PK, auto-increment |
| FullName | VARCHAR(50) | NOT NULL |
| Email | VARCHAR(100) | NOT NULL, UNIQUE (stored in lower case) |
| PasswordHash | VARCHAR(255) | NOT NULL (bcrypt) |
| WeeklyBudget | DECIMAL(6,2) | default 0 |
| IsActive | BOOLEAN | default 1 |
| DateJoined | DATE | default current date |

**Recipes** (Recipes & Meal Planning – Albina)

| Attribute | Type | Key / notes |
|---|---|---|
| RecipeID | INTEGER | PK, auto-increment |
| RecipeName | VARCHAR(80) | NOT NULL |
| MealType | VARCHAR(20) | breakfast / lunch / dinner / snack |
| PricePerPortion | DECIMAL(5,2) | NOT NULL |
| Calories | INTEGER | NOT NULL |
| IsVegetarian | BOOLEAN | default 0 |
| DateAdded | DATE | default current date |

**Workouts** (Workouts & Progress – Priyanka)

| Attribute | Type | Key / notes |
|---|---|---|
| WorkoutID | INTEGER | PK, auto-increment |
| WorkoutName | VARCHAR(60) | NOT NULL |
| Goal | VARCHAR(30) | lose weight / build muscle / stay healthy |
| Difficulty | VARCHAR(15) | easy / medium / hard |
| DurationMinutes | INTEGER | NOT NULL |
| IsBeginnerFriendly | BOOLEAN | default 0 |
| DateCreated | DATE | default current date |

**MealPlanEntry** (Users ↔ Recipes)

| Attribute | Type | Key / notes |
|---|---|---|
| EntryID | INTEGER | PK |
| UserID | INTEGER | FK → Users, cascade delete |
| RecipeID | INTEGER | FK → Recipes, cascade delete |
| PlanDate | DATE | NOT NULL |
| MealSlot | VARCHAR(10) | lunch / dinner |

**WorkoutLog** (Users ↔ Workouts)

| Attribute | Type | Key / notes |
|---|---|---|
| LogID | INTEGER | PK |
| UserID | INTEGER | FK → Users, cascade delete |
| WorkoutID | INTEGER | FK → Workouts, cascade delete |
| LogDate | DATE | NOT NULL |
| IsCompleted | BOOLEAN | default 0 |

### Extensions to the draft ERD

These supporting tables are needed for the features. No columns were added to the core tables. Please add them to the ERD.

| Table | Columns | Keys / notes |
|---|---|---|
| **UserProfile** | ProfileID, UserID, Goal VARCHAR(30), DietType VARCHAR(20), ReminderDay VARCHAR(10), **TrainingDays INTEGER** | PK ProfileID; UserID FK UNIQUE (1:1 with Users). DietType: none / vegetarian / vegan / halal. TrainingDays (2–5) was added for the Sprint 3 workout plan. |
| **Admins** | AdminID, Username VARCHAR(50), PasswordHash VARCHAR(255) | PK AdminID; Username UNIQUE |
| **RecipeIngredient** | RecipeIngredientID, RecipeID, IngredientName VARCHAR(60), Quantity DECIMAL(6,2), Unit VARCHAR(15), Cost DECIMAL(5,2) | FK RecipeID. Quantities and costs are for **one portion**; seeded PricePerPortion = sum of ingredient costs. |
| **RecipeDietTag** | RecipeID, DietType VARCHAR(20) | Composite PK (RecipeID, DietType). Values vegan / halal; vegetarian uses Recipes.IsVegetarian. |
| **RecipeStep** | StepID, RecipeID, StepNumber INTEGER, Instruction VARCHAR(255) | FK RecipeID |
| **WorkoutExercise** | ExerciseID, WorkoutID, ExerciseName VARCHAR(60), Sets INTEGER, Reps INTEGER, Instructions VARCHAR(255), MediaURL VARCHAR(255) | FK WorkoutID |
| **WeightLog** | WeightLogID, UserID, WeightKg DECIMAL(5,2), LogDate DATE | FK UserID |
| **FavouriteRecipe** | UserID, RecipeID, DateSaved DATE | Composite PK (UserID, RecipeID) |
| **ShoppingCheck** | UserID, WeekStart DATE, IngredientName VARCHAR(60), IsChecked BOOLEAN | Composite PK (UserID, WeekStart, IngredientName) |

## Seed data

`npm run seed` creates 1 admin, 3 demo students (with profiles, budgets 300 / 450 / 600 kr), 26 recipes (breakfast, lunch, dinner and snack, 10–45 kr per portion, each with ingredients, costs and 3–6 steps, vegetarian / vegan / halal mix), 9 workouts (3 per goal, mixed difficulty, 4–6 exercises each with a "how to" video search link), and 6 weeks of weight and workout logs for Emma.

## API routes

All request and response bodies are JSON. Errors look like `{ "error": "message" }` with a matching status code (400 invalid input, 401 not logged in / wrong login, 403 deactivated, 404 not found, 409 email in use). No response ever contains a password hash.

### Accounts – Muin

| Method | Path | Login | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | – | Create account `{ fullName, email, password, confirmPassword }` and log in |
| POST | `/api/auth/login` | – | Log in `{ email, password }` |
| POST | `/api/auth/logout` | – | Log out |
| GET | `/api/users/me` | student | Own account and profile |
| PUT | `/api/users/me/details` | student | Change `{ fullName, email }` |
| PUT | `/api/users/me/budget` | student | Set `{ weeklyBudget }` (positive, kr) |
| PUT | `/api/users/me/profile` | student | Set `{ goal, dietType }` |
| PUT | `/api/users/me/password` | student | Change `{ currentPassword, newPassword, confirmPassword }` |

### Recipes & Meal Planning – Albina

| Method | Path | Login | Description |
|---|---|---|---|
| GET | `/api/recipes?search=&mealType=&diet=` | student | Recipe cards; search by name, filter by meal type (breakfast/lunch/dinner/snack) and diet (vegetarian/vegan/halal) |
| GET | `/api/recipes/:id` | student | One recipe with ingredients (per portion) and steps |
| GET | `/api/mealplans?week=` | student | The week's plan (Monday–Sunday, lunch + dinner), total cost vs budget, warning if over budget |
| POST | `/api/mealplans/generate?week=` | student | Create or replace the week's plan within budget and diet |
| GET | `/api/mealplans/shopping-list?week=` | student | The week's ingredients combined by name and unit, with tick state |
| PUT | `/api/mealplans/shopping-list/items?week=` | student | Tick / untick `{ ingredientName, isChecked }` (saved in ShoppingCheck) |

**Which week:** every meal plan route takes `?week=this` or `?week=next`. Without it, **Sunday means next week** (the coming Monday–Sunday) and Monday–Saturday means the current week. The meal plan and shopping list pages have a "This week / Next week" switch that defaults the same way; the choice is kept in the address, e.g. `/mealplan.html?week=next`.

**How the meal plan is generated:** lunch and dinner recipes that fit the student's diet are candidates. For each of the 14 slots, a recipe is picked at random from those that still leave enough budget for the cheapest recipe in every slot left to fill, preferring recipes used least so far (variety). This keeps the week within budget whenever that is possible. If even the cheapest possible week is over budget, the cheapest recipe is used for every slot and a warning is shown. Money is calculated in øre (whole numbers) to avoid rounding errors.

### Workouts & Progress – Priyanka

Coming in Sprint 3.

### Admin

Coming in Phase 4.

## User stories and Jira tickets

| Sprint | Jira | User story | Status |
|---|---|---|---|
| 1 | FF-7 | Sign up | Done |
| 1 | FF-8 | Log in / log out | Done |
| 1 | FF-9 | Goal and diet type | Done |
| 1 | FF-10 | Weekly food budget | Done |
| 1 | FF-11 | Navigation (shared header, active page, login redirect) | Done |
| 1 | – | Edit profile / change password, home page, landing page | Done (supporting tasks, no separate Jira key) |
| 2 | FF-12 | Browse recipes (search, filters, detail with ingredients and steps) | Done |
| 2 | FF-13 | Weekly meal plan within budget and diet | Done |
| 2 | FF-14 | Shopping list (combined ingredients) | Done |
| 2 | FF-15 | Tick off shopping items | Done |
| 3 | FF-16 to FF-20 | Workout plan, log a workout, exercise instructions, log weight, progress chart | Planned |
| 4 | FF-21 to FF-26 | Phone layout, spending vs budget, swap a meal, shopping list cost, favourites, weekly reminder | Planned |

## Project structure

```
server.js              Express app: sessions, routes, page protection, errors
db/schema.sql          All CREATE TABLE statements
db/database.js         SQLite connection (creates tables if missing)
db/seed.js             Demo data (npm run seed)
routes/                One file per component area (header comment names the owner)
middleware/            requireLogin (and requireAdmin in Phase 4)
utils/                 Shared date and validation helpers
public/                HTML pages, css/style.css, js/ (one file per page + shared api.js, nav.js, recipeDetail.js), img/
tests/                 API tests (node:test + supertest)
```
