import math

# Apply decay based on the number of missed tasks
def apply_decay(decay_value, missed_tasks):
    return decay_value * missed_tasks

# Update the decay rate based on the current level
def update_decay_rate(current_decay_rate, increment, level):
    return current_decay_rate + (increment * ((level-50) // 10))

# Calculate the points required to level up based on the current level
def calculate_points_to_level_up(current_level, current_points_to_level_up):
    if 50 <= current_level < 60:
        return current_points_to_level_up + 2
    elif current_level >= 60:
        return int(current_points_to_level_up * 1.05)
    else:
        return 10

# Ensure the rating does not exceed 99
def ensure_max_rating(rating):
    return min(rating, 99)

# Main function to calculate the days required to reach the target focus ratings
def calculate_days_to_reach_focus_rating(target_focus_ratings, physicality_objectives_per_week, mindfulness_objectives_per_week, profession_objectives_per_week, missed_physicality_objectives_per_week, missed_mindfulness_objectives_per_week, missed_profession_objectives_per_week, miss_frequency_weeks):
    # Constants
    points_per_physicality_objective = 22 
    points_per_mindfulness_objective = 26
    points_per_profession_objective = 10
    decay_value_change = -1  # changes decay value every 10 levels
    
    initial_decay_value = -2
    
    # Initial Points to Level Up: points needed to go from rating 50 to 51
    initial_points_to_level_up_physicality = 10
    initial_points_to_level_up_mindfulness = 10
    initial_points_to_level_up_profession = 10 
    points_to_level_up_physicality = initial_points_to_level_up_physicality
    points_to_level_up_mindfulness = initial_points_to_level_up_mindfulness
    points_to_level_up_profession = initial_points_to_level_up_profession
    
    # Initial Ratings (to start with focus rating of 50)
    initial_focus_rating = 50
    physicality_rating = initial_focus_rating
    mindfulness_rating = initial_focus_rating
    profession_rating = initial_focus_rating
    
    current_day = 0
    decay_value = initial_decay_value
    
    days_to_reach_target = {}
    
    # Initial debug print
    print(f"Initial Ratings - Physicality: {physicality_rating}, Mindfulness: {mindfulness_rating}, Profession: {profession_rating}")
    print(f"Initial Focus Rating: {(physicality_rating + mindfulness_rating + profession_rating) / 3}\n")
    
    while True:
        current_day += 1
        
        # Calculate weekly points
        if current_day % 7 == 0:
            week_number = current_day // 7
            
            # Determine if objectives are missed this week
            if week_number % miss_frequency_weeks == 0:
                missed_physicality = missed_physicality_objectives_per_week
                missed_mindfulness = missed_mindfulness_objectives_per_week
                missed_profession = missed_profession_objectives_per_week
            else:
                missed_physicality = 0
                missed_mindfulness = 0
                missed_profession = 0
            
            physicality_points = max(0, (physicality_objectives_per_week - missed_physicality) * points_per_physicality_objective + apply_decay(decay_value, missed_physicality))
            mindfulness_points = max(0, (mindfulness_objectives_per_week - missed_mindfulness) * points_per_mindfulness_objective + apply_decay(decay_value, missed_mindfulness))
            profession_points = max(0, (profession_objectives_per_week - missed_profession) * points_per_profession_objective + apply_decay(decay_value, missed_profession))
            
            # Debug prints
            print(f"Day {current_day}:")
            print(f"Physicality points earned: {physicality_points}")
            print(f"Mindfulness points earned: {mindfulness_points}")
            print(f"Profession points earned: {profession_points}")
            
            # Update ratings
            physicality_rating += physicality_points // points_to_level_up_physicality
            mindfulness_rating += mindfulness_points // points_to_level_up_mindfulness
            profession_rating += profession_points // points_to_level_up_profession

            # Ensure ratings do not exceed 99
            physicality_rating = ensure_max_rating(physicality_rating)
            mindfulness_rating = ensure_max_rating(mindfulness_rating)
            profession_rating = ensure_max_rating(profession_rating)
            
            # Update points to level up
            points_to_level_up_physicality = calculate_points_to_level_up(physicality_rating, points_to_level_up_physicality)
            points_to_level_up_mindfulness = calculate_points_to_level_up(mindfulness_rating, points_to_level_up_mindfulness)
            points_to_level_up_profession = calculate_points_to_level_up(profession_rating, points_to_level_up_profession)

            # Update decay rate
            decay_value = update_decay_rate(initial_decay_value, decay_value_change, max(physicality_rating, mindfulness_rating, profession_rating))
        
        # Calculate Focus Rating
        focus_rating = (physicality_rating + mindfulness_rating + profession_rating) / 3
        
        # Debug prints
        print(f"Ratings - Physicality: {physicality_rating}, Mindfulness: {mindfulness_rating}, Profession: {profession_rating}")
        print(f"Focus Rating: {focus_rating}\n")
        
        # Check if target focus ratings are achieved
        for target_focus_rating in target_focus_ratings:
            if focus_rating >= target_focus_rating and target_focus_rating not in days_to_reach_target:
                days_to_reach_target[target_focus_rating] = current_day
        
        # If all target ratings are achieved, break the loop
        if len(days_to_reach_target) == len(target_focus_ratings):
            break
            
        # Safety condition to prevent infinite loop
        if current_day > 50000:  # Arbitrary large number to avoid infinite loops
            print("Reached safety condition, exiting to prevent infinite loop")
            break
            
    return days_to_reach_target

# Example usage
target_focus_ratings = [60, 70, 80, 90]  # Replace with desired focus ratings
physicality_objectives_per_week = 3
mindfulness_objectives_per_week = 2
profession_objectives_per_week = 5
missed_physicality_objectives_per_week = 1
missed_mindfulness_objectives_per_week = 1
missed_profession_objectives_per_week = 2
miss_frequency_weeks = 2  # Miss objectives every 2 weeks

days_to_reach_target = calculate_days_to_reach_focus_rating(
    target_focus_ratings,
    physicality_objectives_per_week,
    mindfulness_objectives_per_week,
    profession_objectives_per_week,
    missed_physicality_objectives_per_week,
    missed_mindfulness_objectives_per_week,
    missed_profession_objectives_per_week,
    miss_frequency_weeks
)

for target, days in days_to_reach_target.items():
    print(f"Weeks to reach focus rating {target}: {days//7}")
