package br.com.protecextintores.nativo

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
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
    outlineVariant = Color(0xFFD3DCFA),
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
    outlineVariant = Color(0xFF26324D),
    error = Color(0xFFFF8A80),
    onError = Color(0xFF0F131F)
)

@OptIn(ExperimentalTextApi::class)
private val Nunito = FontFamily(
    listOf(400, 500, 600, 700, 800, 900).map { value ->
        Font(R.font.nunito, weight = FontWeight(value),
            variationSettings = FontVariation.Settings(FontVariation.weight(value)))
    }
)

private val ProtecTypography = Typography().let {
    Typography(
        headlineLarge = it.headlineLarge.copy(fontFamily = Nunito),
        headlineMedium = it.headlineMedium.copy(fontFamily = Nunito),
        headlineSmall = it.headlineSmall.copy(fontFamily = Nunito),
        titleLarge = it.titleLarge.copy(fontFamily = Nunito),
        titleMedium = it.titleMedium.copy(fontFamily = Nunito),
        titleSmall = it.titleSmall.copy(fontFamily = Nunito),
        bodyLarge = it.bodyLarge.copy(fontFamily = Nunito),
        bodyMedium = it.bodyMedium.copy(fontFamily = Nunito),
        bodySmall = it.bodySmall.copy(fontFamily = Nunito),
        labelLarge = it.labelLarge.copy(fontFamily = Nunito),
        labelMedium = it.labelMedium.copy(fontFamily = Nunito),
        labelSmall = it.labelSmall.copy(fontFamily = Nunito)
    )
}

@Composable
fun ProtecTheme(mode: String, content: @Composable () -> Unit) {
    val dark = when (mode) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    MaterialTheme(colorScheme = if (dark) DarkColors else LightColors, typography = ProtecTypography, content = content)
}
