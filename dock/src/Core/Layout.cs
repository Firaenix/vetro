using System;

namespace Launcher.Core
{
    internal struct Box
    {
        public int X, Y, W, H;
        public bool Equals(Box o) { return X == o.X && Y == o.Y && W == o.W && H == o.H; }
    }

    /// <summary>
    /// Geometry of the dock. Pure arithmetic, no EFL: the window is only as large as the
    /// glass pill plus a shadow margin, centred at the bottom of the screen, so the
    /// compositor blends a few hundred thousand pixels instead of a full 1080p plane.
    ///
    /// Coordinates are window-relative unless noted. "Content space" is the unscrolled
    /// strip of icons, with item i centred at <c>Icon/2 + i*Pitch</c>.
    /// </summary>
    internal sealed class DockLayout
    {
        public const int Icon = 104;
        public const int FocusIcon = 132;
        public const int Gap = 24;
        public const int PadX = 40;
        public const int PadTop = 24;
        public const int LabelGap = 10;
        public const int LabelH = 34;
        public const int PadBottom = 16;
        public const int Margin = 28;          // room for the pill shadow on every side
        public const int BottomGap = 12;       // window bottom to screen bottom
        public const int ScreenSideGap = 24;   // pill never closer than this to the screen edge
        public const int HighlightPad = 24;      // reach of the soft glow around the focused icon
        public const int SlideDistance = 48;
        // The apps clipper is wider than the app viewport by this much on both sides, so the enlarged focused
        // icon is never cut at the first and last app. (The glow is not clipped: it always fits in the padding.)
        public const int ClipPad = (FocusIcon - Icon) / 2 + 2;
        /// <summary>Space between the scrolling apps and the pinned system entries; the divider sits in its middle.</summary>
        public const int GroupGap = 56;
        public const int Pitch = Icon + Gap;
        /// <summary>Smallest space kept between the label and the clock; with less, the clock is not drawn.</summary>
        public const int ClockGap = 16;
        // Room for the navigation hint ("Input" above the apps, "Back" below the inputs): HintH is the
        // whole band, the capsule inside it is CapsuleH tall and HintH - CapsuleH away from the pill.
        public const int HintH = 46;
        public const int CapsuleH = 36;
        public const int DividerW = 2;
        public const int DividerH = 56;

        public readonly int Count, ScreenW, ScreenH;
        /// <summary>Natural width of the whole strip: the apps, then (when grouped) the gap and the pinned entries.</summary>
        public readonly int ContentW;
        /// <summary>Width of the area the apps scroll in; with pinned entries it excludes them and the gap.</summary>
        public readonly int ViewportW;
        public readonly int PillW, PillH, WinW, WinH, WinX, WinY;
        /// <summary>Number of items that scroll (all of them without a group) and of pinned system entries.</summary>
        public readonly int AppCount, PinnedCount;
        /// <summary>Width of the app strip alone, and of the pinned entries alone.</summary>
        public readonly int AppsW, PinnedW;
        /// <summary>Shift of this page's pill inside a window made for a wider page (0 for the widest).</summary>
        public readonly int OffsetX;
        /// <summary>
        /// True for the panel page: its pill sits <see cref="HintH"/> higher than the apps pill, and the
        /// freed band underneath holds the back hint. The window is the same height for both pages.
        /// </summary>
        public readonly bool Raised;
        /// <summary>Index of the first pinned system entry when the strip ends with a run of them, else -1.</summary>
        public readonly int GroupStart;

        public DockLayout(int count, int screenW, int screenH) : this(count, screenW, screenH, 0) { }

        public DockLayout(int count, int screenW, int screenH, int windowW) : this(count, screenW, screenH, windowW, false, -1) { }

        /// <summary>
        /// <paramref name="windowW"/> is the width of the shared window when it was sized for a
        /// wider page: this page's pill is then centred inside it instead of making its own window.
        /// <paramref name="groupStart"/> marks where the system entries begin (a divider is drawn
        /// before them); anything outside 1..count-1 means no group.
        /// </summary>
        public DockLayout(int count, int screenW, int screenH, int windowW, bool raised, int groupStart)
        {
            if (count < 1) throw new ArgumentOutOfRangeException("count");
            if (screenW < 640 || screenH < 360) throw new ArgumentOutOfRangeException("screen");
            Count = count; ScreenW = screenW; ScreenH = screenH;
            GroupStart = groupStart > 0 && groupStart < count ? groupStart : -1;
            AppCount = GroupStart < 0 ? count : GroupStart;
            PinnedCount = count - AppCount;
            AppsW = AppCount * Icon + (AppCount - 1) * Gap;
            PinnedW = PinnedCount == 0 ? 0 : PinnedCount * Icon + (PinnedCount - 1) * Gap;
            int fixedW = PinnedCount == 0 ? 0 : GroupGap + PinnedW;
            ContentW = AppsW + fixedW;
            int maxPill = screenW - 2 * Margin - 2 * ScreenSideGap;
            PillW = Math.Min(ContentW + 2 * PadX, maxPill);
            ViewportW = PillW - 2 * PadX - fixedW;
            PillH = PadTop + FocusIcon + LabelGap + LabelH + PadBottom;
            WinW = PillW + 2 * Margin;
            if (windowW > WinW) { OffsetX = (windowW - WinW) / 2; WinW = windowW; }
            WinH = PillH + 2 * Margin + HintH;
            Raised = raised;
            WinX = (screenW - WinW) / 2;
            WinY = screenH - WinH - BottomGap;
        }

        /// <summary>True when the apps do not fit their viewport; the pinned entries never move.</summary>
        public bool Scrolls { get { return AppsW > ViewportW; } }

        /// <summary>Window-relative x of the pill's left edge.</summary>
        public int Left { get { return Margin + OffsetX; } }

        /// <summary>Content-space centre of an app slot at fractional position <paramref name="pos"/> (before scrolling).</summary>
        public float CenterOf(float pos) { return Icon / 2f + pos * Pitch; }

        /// <summary>
        /// X of item <paramref name="i"/>'s centre relative to the start of the icon area: apps move with
        /// <paramref name="scroll"/>, pinned entries stand still after the apps' viewport and the group gap.
        /// </summary>
        public float ItemCenter(int i, float scroll)
        {
            if (GroupStart >= 0 && i >= GroupStart) return ViewportW + GroupGap + Icon / 2f + (i - GroupStart) * Pitch;
            return CenterOf(i) - scroll;
        }

        /// <summary>
        /// Scroll offset that keeps <paramref name="focusPos"/> centred in the apps' viewport, clamped to the
        /// strip. Once the focus is on the pinned entries the apps rest where the last app left them.
        /// </summary>
        public float ScrollFor(float focusPos)
        {
            if (!Scrolls) return 0f;
            float f = focusPos > AppCount - 1 ? AppCount - 1 : focusPos;
            float s = CenterOf(f) - ViewportW / 2f;
            float max = AppsW - ViewportW;
            return s < 0f ? 0f : (s > max ? max : s);
        }

        /// <summary>0..1: how strongly item <paramref name="i"/> is focused while the focus is at <paramref name="focusPos"/>.</summary>
        public static float Amount(float focusPos, int i)
        {
            float a = 1f - Math.Abs(focusPos - i);
            return a < 0f ? 0f : (a > 1f ? 1f : a);
        }

        /// <summary>Window-relative y of the pill's top edge (without the slide).</summary>
        public int Top { get { return Margin + (Raised ? 0 : HintH); } }

        public int RowCenterY { get { return Top + PadTop + FocusIcon / 2; } }

        public Box IconBox(int i, float focusPos, float scroll, int slide)
        {
            float amount = Amount(focusPos, i);
            // Even sizes only: an odd size would put the centre half a pixel off and the icon would wobble
            // sideways while it grows. FocusIcon - Icon is even (checked by the tests).
            int size = Icon + 2 * (int)Math.Round((FocusIcon - Icon) / 2f * amount);
            int cx = (int)Math.Round(Left + PadX + ItemCenter(i, scroll));
            Box b;
            b.W = size; b.H = size;
            b.X = cx - size / 2;
            b.Y = RowCenterY - size / 2 + slide;
            return b;
        }

        /// <summary>
        /// The glow does not travel: it is lit on the icon being left and on the icon being reached, and
        /// cross-fades between them. Returns the two items and the weight (0..1) of the second; the first
        /// has 1 minus that. At rest, or at either end of the strip, the second weight is 0.
        /// </summary>
        public void GlowAt(float focusPos, out int first, out int second, out float weightSecond)
        {
            float p = focusPos < 0f ? 0f : (focusPos > Count - 1 ? Count - 1 : focusPos);
            first = (int)p;
            second = first < Count - 1 ? first + 1 : first;
            weightSecond = second == first ? 0f : p - first;
        }

        /// <summary>Box of the glow around item <paramref name="i"/> (its final size; only its opacity changes).</summary>
        public Box GlowBox(int i, float scroll, int slide)
        {
            int size = FocusIcon + 2 * HighlightPad;
            int cx = (int)Math.Round(Left + PadX + ItemCenter(i, scroll));
            Box b;
            b.W = size; b.H = size;
            b.X = cx - size / 2;
            b.Y = RowCenterY - size / 2 + slide;
            return b;
        }

        public Box PillBox(int slide)
        {
            Box b; b.X = Left; b.Y = Top + slide; b.W = PillW; b.H = PillH; return b;
        }

        public Box ShadowBox(int slide)
        {
            const int extra = 20;
            Box b; b.X = Left - extra; b.Y = Top - extra + 10 + slide; b.W = PillW + 2 * extra; b.H = PillH + 2 * extra; return b;
        }

        /// <summary>Window-relative x of the centre of item <paramref name="item"/>'s label (under its icon).</summary>
        public int LabelCenterX(int item, float scroll)
        {
            return (int)Math.Round(Left + PadX + ItemCenter(item, scroll));
        }

        /// <summary>Window-relative left edge of an item's label: centred under its icon, kept inside the icon area of the pill.</summary>
        public int LabelLeft(int item, float scroll, int labelW)
        {
            int x = LabelCenterX(item, scroll) - labelW / 2;
            int min = Left + PadX, max = Left + PillW - PadX - labelW;
            if (max < min) return Left + (PillW - labelW) / 2;   // label wider than the pill interior: centre it
            return x < min ? min : (x > max ? max : x);
        }

        public int LabelTop(int slide) { return Top + PadTop + FocusIcon + LabelGap + slide; }

        /// <summary>
        /// Window-relative y of the hint capsule: above the pill on the apps page (which points up to the
        /// inputs), below it on the panel page (which points back down).
        /// </summary>
        public int HintTop(int slide)
        {
            int gap = HintH - CapsuleH;
            return (Raised ? Top + PillH + gap : Top - gap - CapsuleH) + slide;
        }

        /// <summary>Window-relative x of a hint capsule of the given width: centred on the pill.</summary>
        public int HintLeft(int capsuleW) { return Left + (PillW - capsuleW) / 2; }

        /// <summary>The hairline between the apps and the pinned system entries, centred in the group gap. It never scrolls.</summary>
        public Box DividerBox(float scroll, int slide)
        {
            Box b;
            b.W = DividerW; b.H = DividerH;
            b.X = Left + PadX + ViewportW + (GroupGap - DividerW) / 2;
            b.Y = RowCenterY - DividerH / 2 + slide;
            return b;
        }

        /// <summary>Window-relative right edge of the clock, on the label row.</summary>
        public int ClockRight { get { return Left + PillW - PadX; } }

        /// <summary>
        /// The label always belongs under its icon, so the clock is the one that gives way: it is drawn
        /// only while it keeps <see cref="ClockGap"/> pixels away from the label box.
        /// </summary>
        public bool ClockClear(int labelX, int labelW, int clockW)
        {
            return labelX + labelW + ClockGap <= ClockRight - clockW;
        }

        /// <summary>Window-relative x range in which scrolled items are visible.</summary>
        public int ViewLeft { get { return Left + PadX; } }
        public int ViewRight { get { return Left + PadX + ViewportW; } }
    }
}
