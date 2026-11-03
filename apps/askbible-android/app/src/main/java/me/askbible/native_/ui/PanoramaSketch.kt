package me.askbible.native_.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate

/** Decorative drawings contain no text; all translated labels are Compose Text. */
@Composable
internal fun PanoramaSketch(stage: Int, modifier: Modifier, ink: Color) {
    Canvas(modifier) {
        val factor = minOf(size.width / 100f, size.height / 80f)
        translate((size.width - 100f * factor) / 2f, 0f) {
        scale(factor, factor, pivot=Offset.Zero) {
            fun line(x:Float,y:Float,a:Float,b:Float) = drawLine(ink,Offset(x,y),Offset(a,b),1.4f)
            fun curve(x:Float,y:Float,a:Float,b:Float,c:Float,d:Float,e:Float,f:Float) {
                drawPath(Path().apply { moveTo(x,y);cubicTo(a,b,c,d,e,f) },ink,style=Stroke(1.2f))
            }
            curve(5f,70f,30f,62f,65f,63f,95f,70f)
            when(stage) {
                0,1,5 -> {
                    line(48f,64f,50f,25f);line(50f,47f,28f,28f);line(50f,43f,73f,22f);line(50f,35f,43f,15f)
                    if(stage != 1) listOf(25f to 24f,40f to 18f,57f to 16f,73f to 23f,34f to 36f,65f to 36f).forEach { (x,y) ->
                        drawCircle(ink.copy(alpha=.1f),13f,Offset(x,y));drawCircle(ink,12f,Offset(x,y),style=Stroke(.8f))
                    }
                    if(stage == 5) { curve(58f,65f,95f,72f,15f,73f,40f,80f);curve(67f,65f,105f,74f,38f,74f,54f,80f) }
                    if(stage == 0) drawCircle(ink.copy(alpha=.5f),6f,Offset(87f,12f))
                }
                2 -> {
                    val p=Path().apply { moveTo(17f,64f);lineTo(48f,24f);lineTo(80f,64f);close() }
                    drawPath(p,ink.copy(alpha=.1f));drawPath(p,ink,style=Stroke(1.5f))
                    line(48f,24f,48f,64f);line(48f,24f,63f,64f);line(48f,24f,90f,64f)
                    listOf(15f to 14f,72f to 10f,87f to 28f,35f to 7f).forEach { (x,y)->line(x-3,y,x+3,y);line(x,y-3,x,y+3) }
                }
                3 -> {
                    drawCircle(ink.copy(alpha=.1f),26f,Offset(52f,53f))
                    val p=Path().apply { moveTo(43f,61f);lineTo(43f,28f);lineTo(30f,28f);lineTo(30f,21f);lineTo(43f,21f);lineTo(43f,8f);lineTo(51f,8f);lineTo(51f,21f);lineTo(64f,21f);lineTo(64f,28f);lineTo(51f,28f);lineTo(51f,61f) }
                    drawPath(p,ink.copy(alpha=.2f));drawPath(p,ink,style=Stroke(1.5f))
                }
                4 -> {
                    curve(40f,72f,65f,45f,18f,44f,25f,14f);curve(48f,72f,78f,42f,65f,39f,70f,8f);curve(56f,72f,85f,47f,80f,37f,96f,28f)
                    line(25f,14f,19f,22f);line(25f,14f,31f,21f);line(70f,8f,63f,17f);line(70f,8f,76f,17f);line(96f,28f,86f,29f);line(96f,28f,94f,38f)
                }
            }
        }}
    }
}

@Composable
internal fun PanoramaBookGlyph(modifier: Modifier, ink: Color) {
    Canvas(modifier) {
        scale(size.width/32f,size.height/44f,pivot=Offset.Zero) {
            val p=Path().apply { moveTo(4f,9f);lineTo(25f,3f);lineTo(28f,6f);lineTo(28f,36f);lineTo(8f,42f);lineTo(4f,39f);close();moveTo(4f,9f);lineTo(8f,12f);lineTo(28f,6f);moveTo(8f,12f);lineTo(8f,42f) }
            drawPath(p,ink,style=Stroke(1.3f))
        }
    }
}
