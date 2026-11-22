package br.com.protecextintores.nativo

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val LightColors = lightColorScheme(
    primary = Color(0xFF1956C1),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEAF1FF),
    onPrimaryContainer = Color(0xFF0A1233),
    secondary = Color(0xFFC43800),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFEEF2F7),
    onBackground = Color(0xFF152640),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF152640),
    surfaceVariant = Color(0xFFEAF1FF),
    onSurfaceVariant = Color(0xFF526277),
    outline = Color(0xFFDEE6F0),
    outlineVariant = Color(0xFF8A99D6),
    scrim = Color(0xFF0A1233),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFA0C2FF),
    onPrimary = Color(0xFF10254C),
    primaryContainer = Color(0xFF243B67),
    onPrimaryContainer = Color(0xFFFFFFFF),
    secondary = Color(0xFFB9FC01),
    onSecondary = Color(0xFF0F131F),
    background = Color(0xFF0D1523),
    onBackground = Color(0xFFEDF3FF),
    surface = Color(0xFF172335),
    onSurface = Color(0xFFEDF3FF),
    surfaceVariant = Color(0xFF243B67),
    onSurfaceVariant = Color(0xFFA7B7CC),
    outline = Color(0xFF2C3C55),
    outlineVariant = Color(0xFF5D6F93),
    scrim = Color(0xFF02050C),
    error = Color(0xFFFF8A80),
    onError = Color(0xFF0F131F)
)

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
