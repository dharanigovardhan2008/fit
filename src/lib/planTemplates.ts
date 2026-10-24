// Ready-made plans a trainer can send as they are or edit first.
// General guidance only. Trainers should adjust for each member's health, age and food habits.

export interface PlanTemplate {
  id: string;
  kind: "diet" | "workout";
  title: string;
  content: string;
}

const NOTE_WORKOUT = "Warm up 5-10 minutes before and stretch 5 minutes after. Rest 60-90 seconds between sets. Sleep 7-8 hours.";
const NOTE_DIET = "Drink 3-4 litres of water daily. Quantities are a guide, so adjust for the member's weight and health. Avoid sugary drinks.";

export const PLAN_TEMPLATES: PlanTemplate[] = [
  // ---------------------------------------------------------------- Workouts
  {
    id: "w-weight-loss",
    kind: "workout",
    title: "Weight Loss (Fat Burn) - 5 days",
    content: `Goal: burn fat while keeping muscle.

Mon: Full body strength - squats 3x12, push-ups 3x12, dumbbell rows 3x12, plank 3x40s. Then 15 min brisk treadmill.
Tue: Cardio - 30-40 min cycling or treadmill (steady pace) + 10 min abs (crunches, leg raises).
Wed: Lower body - leg press 3x15, lunges 3x12 each leg, glute bridges 3x15, calf raises 3x20. Then 10 min cross trainer.
Thu: HIIT - 8 rounds of 30s fast / 30s slow on bike or rope skipping, then burpees 3x10, mountain climbers 3x30s.
Fri: Upper body + core - shoulder press 3x12, lat pulldown 3x12, bicep curls 3x12, tricep dips 3x12, plank 3x45s.
Sat: Active fun - 45-60 min brisk walk, swim or sports.
Sun: Rest.

${NOTE_WORKOUT}`,
  },
  {
    id: "w-weight-gain",
    kind: "workout",
    title: "Weight Gain (Healthy Bulk) - 4 days",
    content: `Goal: add healthy weight with heavy compound lifts.

Mon: Chest + triceps - bench press 4x8, incline dumbbell press 3x10, cable fly 3x12, tricep pushdown 3x12.
Tue: Back + biceps - deadlift 4x6, lat pulldown 3x10, seated row 3x10, barbell curl 3x10.
Wed: Rest or 20 min easy walk.
Thu: Legs - squats 4x8, leg press 3x12, Romanian deadlift 3x10, leg curl 3x12, calf raises 4x15.
Fri: Shoulders + arms - overhead press 4x8, lateral raise 3x12, hammer curl 3x10, skull crusher 3x10.
Sat-Sun: Rest. Keep cardio light (10-15 min only) so calories go into growth.

Add 2.5 kg to the main lifts whenever all sets feel easy. ${NOTE_WORKOUT}`,
  },
  {
    id: "w-muscle-gain",
    kind: "workout",
    title: "Muscle Gain (Push / Pull / Legs) - 5 days",
    content: `Goal: build lean muscle size and strength.

Mon - Push: bench press 4x8, incline dumbbell press 3x10, shoulder press 3x10, lateral raise 3x15, tricep pushdown 3x12.
Tue - Pull: pull-ups or lat pulldown 4x8, barbell row 4x8, face pull 3x15, dumbbell curl 3x10, hammer curl 3x12.
Wed - Legs: squats 4x8, leg press 3x12, Romanian deadlift 3x10, leg extension 3x12, leg curl 3x12, calf raises 4x15.
Thu - Upper: incline press 3x10, cable row 3x10, arnold press 3x10, preacher curl 3x10, overhead tricep extension 3x12.
Fri - Lower + abs: deadlift 3x6, walking lunges 3x12, hip thrust 3x10, hanging leg raise 3x12, plank 3x60s.
Sat-Sun: Rest or light walk.

Track weights each week and aim to add reps or load. ${NOTE_WORKOUT}`,
  },
  {
    id: "w-recomp",
    kind: "workout",
    title: "Body Recomposition (Lose Fat, Build Muscle) - 4 days",
    content: `Goal: get leaner and stronger together.

Mon: Upper strength - bench press 4x8, row 4x8, shoulder press 3x10, curls and pushdowns 3x12. Finish with 10 min cardio.
Tue: Lower strength - squats 4x8, Romanian deadlift 3x10, lunges 3x12, calf raises 3x15. Finish with abs.
Wed: Rest or 30 min walk.
Thu: Upper volume - incline press 3x12, lat pulldown 3x12, lateral raise 3x15, cable curls and rope pushdowns 3x15.
Fri: Lower volume + conditioning - leg press 3x15, hip thrust 3x12, step-ups 3x12, then 10 min HIIT.
Sat: 40 min cardio of choice. Sun: Rest.

${NOTE_WORKOUT}`,
  },
  {
    id: "w-beginner",
    kind: "workout",
    title: "Beginner Full Body - 3 days",
    content: `Goal: learn the basics safely and build a habit.

Mon / Wed / Fri (same session each day):
1. Goblet squat 3x12
2. Push-ups (or knee push-ups) 3x10
3. Seated cable row 3x12
4. Dumbbell shoulder press 3x10
5. Glute bridge 3x15
6. Plank 3x30s
7. 10-15 min easy treadmill or cycle

Tue / Thu: 20-30 min walk.   Sat / Sun: Rest.

Focus on correct form with light weights. Add a little weight only when all sets feel easy. ${NOTE_WORKOUT}`,
  },
  {
    id: "w-toning",
    kind: "workout",
    title: "Toning & Core - 4 days",
    content: `Goal: firm and shape the body, improve posture and core strength.

Mon: Lower body - squats 3x15, reverse lunges 3x12, glute bridges 3x15, side-lying leg raises 3x15 each side.
Tue: Upper body - light dumbbell press 3x15, lat pulldown 3x12, lateral raise 3x15, tricep kickbacks 3x15.
Wed: 30 min cardio (cycle, cross trainer or brisk walk) + 10 min stretching.
Thu: Core - plank 3x45s, bicycle crunches 3x20, leg raises 3x12, Russian twists 3x20, bird-dog 3x10.
Fri: Full body circuit - 3 rounds of: squat to press 12, row 12, step-ups 12, mountain climbers 30s.
Sat-Sun: Rest or yoga.

${NOTE_WORKOUT}`,
  },
  {
    id: "w-endurance",
    kind: "workout",
    title: "Strength & Endurance - 4 days",
    content: `Goal: better stamina plus functional strength.

Mon: Strength - squats 4x8, bench press 3x8, row 3x10, plank 3x45s.
Tue: Intervals - 5 min warm up, then 6 rounds of 2 min fast / 2 min easy on treadmill or bike.
Wed: Rest or yoga and stretching.
Thu: Strength - deadlift 3x6, shoulder press 3x8, pull-ups or lat pulldown 3x8, lunges 3x12.
Fri: Long steady cardio - 40-50 min jog, cycle or swim at a conversational pace.
Sat: Circuit - kettlebell swings, box step-ups, battle ropes, sled push (4 rounds, 40s work / 20s rest).
Sun: Rest.

${NOTE_WORKOUT}`,
  },

  // ---------------------------------------------------------------- Diets
  {
    id: "d-weight-loss-veg",
    kind: "diet",
    title: "Weight Loss Diet - Vegetarian (about 1500 kcal)",
    content: `Early morning: warm water with lemon, 5 soaked almonds.
Breakfast: 2 besan chilla or moong dal chilla with mint chutney, or vegetable oats upma, plus 1 cup green tea.
Mid-morning: 1 fruit (apple, guava or papaya) or 1 cup buttermilk.
Lunch: 2 rotis (or 1 small bowl brown rice), 1 bowl dal, 1 bowl sabzi, big salad, 1 small bowl curd.
Evening: roasted chana or sprouts salad (1 bowl) with green tea.
Dinner (before 8:30 pm): 1-2 rotis or a bowl of vegetable khichdi, paneer or tofu bhurji (100 g), steamed vegetables.
Bedtime: 1 glass warm low-fat milk (optional).

Protein goal: about 1 g per kg body weight. Cut out sugar, fried snacks, white bread and sweet drinks. ${NOTE_DIET}`,
  },
  {
    id: "d-weight-loss-nonveg",
    kind: "diet",
    title: "Weight Loss Diet - Non-Vegetarian (about 1600 kcal)",
    content: `Early morning: warm water with lemon, 5 soaked almonds.
Breakfast: 3 egg whites + 1 whole egg omelette with vegetables, 1 slice brown bread, 1 cup green tea.
Mid-morning: 1 fruit or 1 cup buttermilk.
Lunch: 2 rotis or 1 small bowl rice, grilled or curry chicken (120 g, little oil), 1 bowl sabzi, big salad.
Evening: boiled eggs (2) or roasted chana, green tea.
Dinner (before 8:30 pm): grilled fish or chicken (120 g), sauteed vegetables, 1 roti or 1 small bowl of rice.
Bedtime: 1 glass warm low-fat milk (optional).

Protein goal: about 1.2 g per kg body weight. Cut out sugar, fried food and sweet drinks. ${NOTE_DIET}`,
  },
  {
    id: "d-weight-gain-veg",
    kind: "diet",
    title: "Weight Gain Diet - Vegetarian (about 2800 kcal)",
    content: `Early morning: 1 glass milk with 1 banana, 5 soaked almonds and 2 walnuts.
Breakfast: 3 parathas (stuffed with paneer or aloo) with curd, or 2 cups poha with peanuts, plus 1 glass full-fat milk.
Mid-morning: peanut butter sandwich (2 slices) and 1 banana, or a mixed dry fruit handful.
Lunch: 3 rotis + 1 big bowl rice, 1.5 bowls dal or rajma/chole, paneer sabzi, salad, 1 bowl curd, 1 tsp ghee.
Evening: 1 glass milkshake or lassi, plus roasted makhana or a handful of nuts.
Dinner: 3 rotis or 1.5 bowls rice, paneer or soya chunks curry, vegetables, 1 bowl dal.
Bedtime: 1 glass warm milk with 1 tsp honey.

Eat every 3 hours. Do not skip meals. Pair with strength training. ${NOTE_DIET}`,
  },
  {
    id: "d-weight-gain-nonveg",
    kind: "diet",
    title: "Weight Gain Diet - Non-Vegetarian (about 3000 kcal)",
    content: `Early morning: 1 glass milk with 1 banana, 5 soaked almonds.
Breakfast: 4 egg omelette (3 whole + 1 white) with 3 slices bread and butter, 1 glass full-fat milk.
Mid-morning: peanut butter sandwich and 1 banana, or a handful of nuts.
Lunch: 1.5-2 bowls rice or 3 rotis, chicken curry (150 g), dal, vegetables, curd, 1 tsp ghee.
Evening: 3 boiled eggs or a protein shake with oats and banana.
Dinner: 3 rotis or 1.5 bowls rice, fish or chicken (150 g), vegetables, dal.
Bedtime: 1 glass warm milk with 1 tsp honey.

Eat every 3 hours and aim to gain 0.25-0.5 kg per week. ${NOTE_DIET}`,
  },
  {
    id: "d-muscle-gain-nonveg",
    kind: "diet",
    title: "Muscle Gain Diet - Non-Vegetarian (high protein, about 2600 kcal)",
    content: `Early morning: 1 glass water, 1 banana, 5 almonds.
Breakfast: 4 egg whites + 2 whole eggs scrambled, 1 bowl oats with milk, 1 fruit.
Mid-morning: curd (1 cup) with a handful of nuts, or a whey protein shake.
Lunch: 1 bowl rice or 2 rotis, grilled chicken or fish (150-200 g), dal, big salad, vegetables.
Pre-workout (1 hour before): banana + 1 slice brown bread with peanut butter.
Post-workout: whey protein shake (1 scoop) with water or milk, 1 banana.
Dinner: 2 rotis or sweet potato, chicken or fish (150 g) or 4 egg whites, sauteed vegetables.
Bedtime: 1 glass warm milk, or 1 cup paneer cubes.

Protein goal: 1.6-2 g per kg body weight every day. ${NOTE_DIET}`,
  },
  {
    id: "d-muscle-gain-veg",
    kind: "diet",
    title: "Muscle Gain Diet - Vegetarian (high protein, about 2600 kcal)",
    content: `Early morning: 1 glass water, 1 banana, 5 almonds.
Breakfast: 2 besan or paneer chilla + 1 bowl oats with milk, 1 fruit.
Mid-morning: 1 cup Greek yogurt or thick curd with nuts, or a plant or whey protein shake.
Lunch: 1 bowl rice or 2 rotis, 1.5 bowls dal or rajma, soya chunks or paneer (100-150 g), salad, vegetables.
Pre-workout (1 hour before): banana + peanut butter on 1 slice brown bread.
Post-workout: whey or plant protein shake with a banana.
Dinner: 2 rotis, paneer or tofu (150 g), dal, sauteed vegetables.
Bedtime: 1 glass warm milk with 1 tsp honey.

Protein goal: 1.6-2 g per kg body weight. Combine dals with rice or roti, and add sprouts and soya for complete protein. ${NOTE_DIET}`,
  },
  {
    id: "d-maintenance",
    kind: "diet",
    title: "Healthy Maintenance Diet (about 2100 kcal)",
    content: `Early morning: warm water, 5 soaked almonds.
Breakfast: 2 idli or dosa with sambar, or 2 vegetable parathas with curd, plus 1 fruit.
Mid-morning: buttermilk or coconut water.
Lunch: 2-3 rotis or 1 bowl rice, dal, 1 bowl sabzi, salad, 1 bowl curd. Add fish, chicken or paneer (100 g) 3-4 times a week.
Evening: roasted chana, sprouts or a fruit with tea.
Dinner: 2 rotis or khichdi, vegetables and a protein (egg, paneer, chicken or dal).

Fill half the plate with vegetables, keep sweets and fried food to once or twice a week. ${NOTE_DIET}`,
  },
];
