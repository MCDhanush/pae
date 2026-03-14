package utils

import (
	"crypto/rand"
	"math/big"
)

const pinLength = 6

// GeneratePIN returns a cryptographically random 6-digit numeric PIN string,
// left-padded with zeros if necessary.
func GeneratePIN() string {
	const digits = "0123456789"
	result := make([]byte, pinLength)
	for i := range result {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			// Fallback: use a static digit (should never happen in practice).
			result[i] = '0'
			continue
		}
		result[i] = digits[n.Int64()]
	}
	return string(result)
}
