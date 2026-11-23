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
    primary = Color(0xFF1655C7),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFD8E6FC),
    onPrimaryContainer = Color(0xFF182137),
    secondary = Color(0xFF1655C7),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFD8E6FC),
    onSecondaryContainer = Color(0xFF182137),
    tertiary = Color(0xFF82500D),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFFFF0D5),
    onTertiaryContainer = Color(0xFF82500D),
    background = Color(0xFFF2F5FA),
    onBackground = Color(0xFF182137),
    surface = Color(0xFFFCFDFF),
    onSurface = Color(0xFF182137),
    surfaceVariant = Color(0xFFE8EEF8),
    onSurfaceVariant = Color(0xFF536079),
    outline = Color(0xFFDDE5F0),
    outlineVariant = Color(0xFF72829D),
    surfaceTint = Color(0xFF1655C7),
    surfaceDim = Color(0xFFF2F5FA),
    surfaceBright = Color(0xFFFCFDFF),
    surfaceContainerLowest = Color(0xFFFCFDFF),
    surfaceContainerLow = Color(0xFFF2F5FA),
    surfaceContainer = Color(0xFFE8EEF8),
    surfaceContainerHigh = Color(0xFFD8E6FC),
    surfaceContainerHighest = Color(0xFFE2EBFA),
    inverseSurface = Color(0xFF1A2538),
    inverseOnSurface = Color(0xFFEFF3FC),
    inversePrimary = Color(0xFFA4C7FF),
    scrim = Color(0xFF1C2E4B),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFE7E4),
    onErrorContainer = Color(0xFF8A201A)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFA4C7FF),
    onPrimary = Color(0xFF102541),
    primaryContainer = Color(0xFF2D4468),
    onPrimaryContainer = Color(0xFFEFF3FC),
    secondary = Color(0xFFA4C7FF),
    onSecondary = Color(0xFF102541),
    secondaryContainer = Color(0xFF2D4468),
    onSecondaryContainer = Color(0xFFEFF3FC),
    tertiary = Color(0xFFFFD38A),
    onTertiary = Color(0xFF44351A),
    tertiaryContainer = Color(0xFF42321E),
    onTertiaryContainer = Color(0xFFFFD38A),
    background = Color(0xFF121928),
    onBackground = Color(0xFFEFF3FC),
    surface = Color(0xFF1A2538),
    onSurface = Color(0xFFEFF3FC),
    surfaceVariant = Color(0xFF22304A),
    onSurfaceVariant = Color(0xFFA7B1C7),
    outline = Color(0xFF32415A),
    outlineVariant = Color(0xFF7187A9),
    surfaceTint = Color(0xFFA4C7FF),
    surfaceDim = Color(0xFF121928),
    surfaceBright = Color(0xFF324B71),
    surfaceContainerLowest = Color(0xFF121928),
    surfaceContainerLow = Color(0xFF1A2538),
    surfaceContainer = Color(0xFF22304A),
    surfaceContainerHigh = Color(0xFF2D4468),
    surfaceContainerHighest = Color(0xFF324B71),
    inverseSurface = Color(0xFFFCFDFF),
    inverseOnSurface = Color(0xFF182137),
    inversePrimary = Color(0xFF1655C7),
    scrim = Color(0xFF090E17),
    error = Color(0xFFFF8A80),
    onError = Color(0xFF421B17),
    errorContainer = Color(0xFF5C2824),
    onErrorContainer = Color(0xFFFFDAD6)
)

internal val ColorScheme.protecBrand: Color
    get() = if (background.luminance() > .5f) Color(0xFFE8EEF8) else Color(0xFF1D293E)

internal val ColorScheme.protecOnBrand: Color
    get() = if (background.luminance() > .5f) Color(0xFF182137) else Color(0xFFEFF3FC)

internal val ColorScheme.protecAction: Color
    get() = if (background.luminance() > .5f) Color(0xFF1762DF) else Color(0xFF2867DD)

internal val ColorScheme.protecOnAction: Color
    get() = if (background.luminance() > .5f) Color(0xFFFFFFFF) else Color(0xFFFFFFFF)

internal val ColorScheme.protecSuccess: Color
    get() = if (background.luminance() > .5f) Color(0xFF1B6A52) else Color(0xFF9AE1CA)

internal val ColorScheme.protecSuccessContainer: Color
    get() = if (background.luminance() > .5f) Color(0xFFDBF3EA) else Color(0xFF204437)

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
        labelLarge = it.labelLarge.copy(fontFamily = Inter, fontWeight = FontWeight(650)),
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
        shapes = Shapes(extraSmall = RoundedCornerShape(12.dp), small = RoundedCornerShape(14.dp),
            medium = RoundedCornerShape(16.dp), large = RoundedCornerShape(18.dp)),
        content = content
    )
}
