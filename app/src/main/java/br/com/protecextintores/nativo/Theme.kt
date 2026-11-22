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
    primary = Color(0xFF003CFF),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE6ECFF),
    onPrimaryContainer = Color(0xFF0A1233),
    secondary = Color(0xFFC43800),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFF3F6FF),
    onBackground = Color(0xFF0A1233),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0A1233),
    surfaceVariant = Color(0xFFE6ECFF),
    onSurfaceVariant = Color(0xFF4D5A80),
    outline = Color(0xFFD3DCFA),
    outlineVariant = Color(0xFF8A99D6),
    scrim = Color(0xFF0A1233),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFB9FC01),
    onPrimary = Color(0xFF0F131F),
    primaryContainer = Color(0xFF1C2A44),
    onPrimaryContainer = Color(0xFFFFFFFF),
    secondary = Color(0xFFB9FC01),
    onSecondary = Color(0xFF0F131F),
    background = Color(0xFF0E1420),
    onBackground = Color(0xFFFFFFFF),
    surface = Color(0xFF161F30),
    onSurface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFF1C2A44),
    onSurfaceVariant = Color(0xFF9BA7BF),
    outline = Color(0xFF26324D),
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
