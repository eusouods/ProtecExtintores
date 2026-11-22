package br.com.protecextintores.nativo

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
internal fun expressiveActionShape(source: MutableInteractionSource, resting: Dp = 24.dp): Shape {
    val pressed by source.collectIsPressedAsState()
    val corner by animateDpAsState(
        if (pressed) 10.dp else resting,
        spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMedium),
        label = "Forma do botão"
    )
    return RoundedCornerShape(corner)
}

private enum class ActionStyle { Filled, Tonal, Outlined, Text }

@Composable
private fun ExpressiveAction(
    style: ActionStyle,
    onClick: () -> Unit,
    modifier: Modifier,
    enabled: Boolean,
    padding: PaddingValues,
    content: @Composable RowScope.() -> Unit
) {
    val source = remember { MutableInteractionSource() }
    val scheme = MaterialTheme.colorScheme
    val colors = when (style) {
        ActionStyle.Filled -> ButtonDefaults.buttonColors()
        ActionStyle.Tonal -> ButtonDefaults.filledTonalButtonColors()
        ActionStyle.Outlined -> ButtonDefaults.outlinedButtonColors()
        ActionStyle.Text -> ButtonDefaults.textButtonColors()
    }
    val border = if (style == ActionStyle.Outlined) {
        BorderStroke(1.dp, if (enabled) scheme.outlineVariant else scheme.outline)
    } else null
    Button(
        onClick = onClick,
        modifier = modifier.heightIn(min = 48.dp),
        enabled = enabled,
        interactionSource = source,
        shape = expressiveActionShape(source),
        colors = colors,
        border = border,
        elevation = null,
        contentPadding = padding,
        content = content
    )
}

@Composable
internal fun ExpressiveButton(
    onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) = ExpressiveAction(ActionStyle.Filled, onClick, modifier, enabled, PaddingValues(horizontal = 18.dp, vertical = 10.dp), content)

@Composable
internal fun ExpressiveTonalButton(
    onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) = ExpressiveAction(ActionStyle.Tonal, onClick, modifier, enabled, PaddingValues(horizontal = 16.dp, vertical = 8.dp), content)

@Composable
internal fun ExpressiveOutlinedButton(
    onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    content: @Composable RowScope.() -> Unit
) = ExpressiveAction(ActionStyle.Outlined, onClick, modifier, enabled, contentPadding, content)

@Composable
internal fun ExpressiveTextButton(
    onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) = ExpressiveAction(ActionStyle.Text, onClick, modifier, enabled, PaddingValues(horizontal = 10.dp, vertical = 6.dp), content)

@Composable
internal fun ExpressiveIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentColor: Color = MaterialTheme.colorScheme.onSecondaryContainer,
    content: @Composable () -> Unit
) {
    val source = remember { MutableInteractionSource() }
    FilledTonalIconButton(
        onClick = onClick,
        modifier = modifier.size(48.dp),
        enabled = enabled,
        interactionSource = source,
        shape = expressiveActionShape(source),
        colors = IconButtonDefaults.filledTonalIconButtonColors(contentColor = contentColor),
        content = content
    )
}
