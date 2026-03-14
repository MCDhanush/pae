package utils

// CalculateScore returns the points awarded for an answer.
//
// Scoring rules:
//   - A wrong answer always earns 0 points.
//   - A correct answer earns between 50 % and 100 % of basePoints, scaled
//     linearly by how quickly the player answered:
//     points = basePoints * (0.5 + 0.5 * (timeRemaining / totalTime))
//
// timeRemaining and totalTime are both in seconds. If totalTime <= 0 the
// player receives the full basePoints (edge case guard).
func CalculateScore(isCorrect bool, timeRemaining, totalTime, basePoints int) int {
	if !isCorrect {
		return 0
	}

	if totalTime <= 0 {
		return basePoints
	}

	if timeRemaining < 0 {
		timeRemaining = 0
	}
	if timeRemaining > totalTime {
		timeRemaining = totalTime
	}

	ratio := float64(timeRemaining) / float64(totalTime)
	points := float64(basePoints) * (0.5 + 0.5*ratio)

	return int(points)
}
