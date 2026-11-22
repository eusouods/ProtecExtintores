package br.com.protecextintores.nativo

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val LightColors = lightColorScheme(
    primary = Color(0xFF1657E8),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEAF1FF),
    onPrimaryContainer = Color(0xFF142640),
    secondary = Color(0xFF1657E8),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFEAF1FF),
    onSecondaryContainer = Color(0xFF142640),
    tertiary = Color(0xFF76510C),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFFFF4D9),
    onTertiaryContainer = Color(0xFF76510C),
    background = Color(0xFFF6F9FF),
    onBackground = Color(0xFF142640),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF142640),
    surfaceVariant = Color(0xFFF0F5FF),
    onSurfaceVariant = Color(0xFF52637B),
    outline = Color(0xFFE6EDF7),
    outlineVariant = Color(0xFF7489A9),
    surfaceTint = Color(0xFF1657E8),
    surfaceDim = Color(0xFFF6F9FF),
    surfaceBright = Color(0xFFFFFFFF),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF6F9FF),
    surfaceContainer = Color(0xFFF0F5FF),
    surfaceContainerHigh = Color(0xFFEAF1FF),
    surfaceContainerHighest = Color(0xFFDFEAFF),
    inverseSurface = Color(0xFF17243C),
    inverseOnSurface = Color(0xFFEDF3FF),
    inversePrimary = Color(0xFFA1C5FF),
    scrim = Color(0xFF152C56),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFE7E4),
    onErrorContainer = Color(0xFF8A201A)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFA1C5FF),
    onPrimary = Color(0xFF10254C),
    primaryContainer = Color(0xFF233654),
    onPrimaryContainer = Color(0xFFEDF3FF),
    secondary = Color(0xFFA1C5FF),
    onSecondary = Color(0xFF10254C),
    secondaryContainer = Color(0xFF233654),
    onSecondaryContainer = Color(0xFFEDF3FF),
    tertiary = Color(0xFFFFDC91),
    onTertiary = Color(0xFF44351A),
    tertiaryContainer = Color(0xFF44351A),
    onTertiaryContainer = Color(0xFFFFDC91),
    background = Color(0xFF101829),
    onBackground = Color(0xFFEDF3FF),
    surface = Color(0xFF17243C),
    onSurface = Color(0xFFEDF3FF),
    surfaceVariant = Color(0xFF233654),
    onSurfaceVariant = Color(0xFFA7B7CC),
    outline = Color(0xFF304263),
    outlineVariant = Color(0xFF6A83A5),
    surfaceTint = Color(0xFFA1C5FF),
    surfaceDim = Color(0xFF101829),
    surfaceBright = Color(0xFF2A426B),
    surfaceContainerLowest = Color(0xFF101829),
    surfaceContainerLow = Color(0xFF17243C),
    surfaceContainer = Color(0xFF233654),
    surfaceContainerHigh = Color(0xFF233654),
    surfaceContainerHighest = Color(0xFF2A426B),
    inverseSurface = Color(0xFFFFFFFF),
    inverseOnSurface = Color(0xFF142640),
    inversePrimary = Color(0xFF1657E8),
    scrim = Color(0xFF091021),
    error = Color(0xFFFF8A80),
    onError = Color(0xFF421B17),
    errorContainer = Color(0xFF5C2824),
    onErrorContainer = Color(0xFFFFDAD6)
)

internal val ColorScheme.protecBrand: Color
    get() = if (background.luminance() > .5f) Color(0xFFF0F5FF) else Color(0xFF1B2C47)
internal val ColorScheme.protecOnBrand: Color
    get() = if (background.luminance() > .5f) Color(0xFF142640) else Color(0xFFF4F8FF)

@OptIn(ExperimentalTextApi::class)
private val Inter = FontFamily(
    listOf(400, 500, 600, 650, 700, 800, 900).map { value ->
        Font(R.font.inter, weight = FontWeight(value),
            variationSettings = FontVariation.Settings(FontVariation.weight(value)))
    }
)

private val ProtecTypography = Typography().let {
    Typography(
        headlineLarge = it.headlineLarge.copy(fontFamily = Inter),
        headlineMedium = it.headlineMedium.copy(fontFamily = Inter),
        headlineSmall = it.headlineSmall.copy(fontFamily = Inter),
        titleLarge = it.titleLarge.copy(fontFamily = Inter),
        titleMedium = it.titleMedium.copy(fontFamily = Inter),
        titleSmall = it.titleSmall.copy(fontFamily = Inter),
        bodyLarge = it.bodyLarge.copy(fontFamily = Inter),
        bodyMedium = it.bodyMedium.copy(fontFamily = Inter),
        bodySmall = it.bodySmall.copy(fontFamily = Inter),
        labelLarge = it.labelLarge.copy(fontFamily = Inter),
        labelMedium = it.labelMedium.copy(fontFamily = Inter),
        labelSmall = it.labelSmall.copy(fontFamily = Inter)
    )
}

@Composable
fun ProtecTheme(mode: String, content: @Composable () -> Unit) {
    val dark = when (mode) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        typography = ProtecTypography,
        shapes = Shapes(extraSmall = RoundedCornerShape(12.dp), small = RoundedCornerShape(10.dp),
            medium = RoundedCornerShape(14.dp), large = RoundedCornerShape(16.dp)),
        content = content
    )
}
