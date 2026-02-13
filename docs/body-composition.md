# Body Composition

BLE Scale Sync calculates up to 10 body composition metrics from your scale's weight and impedance readings.

## Exported Metrics

| Metric          | Unit  | Formula                                                                  |
| --------------- | ----- | ------------------------------------------------------------------------ |
| Weight          | kg    | Raw scale reading                                                        |
| BMI             | —     | `weight / (height_m)^2`                                                  |
| Body Fat        | %     | BIA: `LBM = c1*(H^2/Z) + c2*W + c3*A + c4`, `BF% = (W - LBM) / W * 100` |
| Water           | %     | `LBM * 0.73 / W * 100` (athlete: 0.74)                                   |
| Bone Mass       | kg    | `LBM * 0.042`                                                            |
| Muscle Mass     | kg    | `LBM * 0.54` (athlete: 0.60)                                             |
| Visceral Fat    | 1–59  | `BF% * 0.55 - 4 + age * 0.08`                                            |
| Physique Rating | 1–9   | Based on BF% and muscle/weight ratio                                     |
| BMR             | kcal  | Mifflin-St Jeor: `10*W + 6.25*H - 5*A + s` (athlete: +5%)                |
| Metabolic Age   | years | `age + (idealBMR - BMR) / 15`                                            |

Where `W` = weight (kg), `H` = height (cm), `A` = age, `Z` = impedance (ohm), `s` = +5 male / -161 female.

## BIA Coefficients

The core body fat calculation uses Bioelectrical Impedance Analysis (BIA) with gender- and athlete-specific coefficients:

|                  | c1    | c2    | c3     | c4   |
| ---------------- | ----- | ----- | ------ | ---- |
| Male             | 0.503 | 0.165 | -0.158 | 17.8 |
| Male (athlete)   | 0.637 | 0.205 | -0.180 | 12.5 |
| Female           | 0.490 | 0.150 | -0.130 | 11.5 |
| Female (athlete) | 0.550 | 0.180 | -0.150 | 8.5  |

## Deurenberg Fallback

When impedance is not available, body fat is estimated using the Deurenberg formula:

```
BF% = 1.2 * BMI + 0.23 * age - 10.8 * sex - 5.4
```

Where `sex`: 1 = male, 0 = female. For athletes, the result is multiplied by 0.85.

## Athlete Mode

Setting `is_athlete: true` in `config.yaml` (or `USER_IS_ATHLETE=true` in `.env`) adjusts the calculation constants for people who exercise regularly. This affects:

- **Lean Body Mass** coefficients (higher lean mass estimation)
- **Water percentage** (athletes have higher hydration: 74% vs 73% of LBM)
- **Skeletal Muscle Mass** factor (60% vs 54% of LBM)
- **BMR** (+5% boost)
- **Metabolic Age** (capped at actual age minus 5 for athletes)

## Scale-Provided Values

Scales that provide their own body composition values (fat, water, muscle, bone) use those directly — only BMI, BMR, metabolic age, visceral fat, and physique rating are always calculated from the formulas above.

## Formula Credits

| Formula                                    | Authors                                                                                                                                                                         | Used For                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **BIA** (Bioelectrical Impedance Analysis) | Lukaski H.C. et al. (1986) — _"Assessment of fat-free mass using bioelectrical impedance measurements of the human body"_, American Journal of Clinical Nutrition               | Body fat % from impedance — the core algorithm    |
| **Mifflin-St Jeor**                        | Mifflin M.D., St Jeor S.T. et al. (1990) — _"A new predictive equation for resting energy expenditure in healthy individuals"_, American Journal of Clinical Nutrition          | Basal Metabolic Rate (BMR)                        |
| **Deurenberg**                             | Deurenberg P., Weststrate J.A., Seidell J.C. (1991) — _"Body mass index as a measure of body fatness: age- and sex-specific prediction formulas"_, British Journal of Nutrition | Body fat % fallback when impedance is unavailable |
