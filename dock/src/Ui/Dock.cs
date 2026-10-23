using System;
using System.IO;
using Launcher.Core;
using Launcher.Native;

namespace Launcher.Ui
{
    /// <summary>
    /// The evas objects of the dock and the code that maps controller state onto them.
    /// Object count is items + 6 (shadow, pill, clipper, highlight, label, clock), plus the divider
    /// when the strip has a system group and two for the navigation hint (word, chevron);
    /// icons are pre-sized PNGs, and <see cref="Apply"/> only calls into EFL for values that changed
    /// since the previous frame, so an animation frame costs a handful of native calls.
    /// </summary>
    internal sealed class Dock
    {
        private const string Font = "SamsungOneUI 500,Sans";

        private readonly IntPtr _win, _evas;
        private readonly DockLayout _layout;
        private readonly AppEntry[] _items;
        private readonly string _assets;
        private readonly Action<string> _log;

        private IntPtr _shadow, _pill, _clip, _appsClip, _highlight, _highlight2, _clock, _divider;
        // Two name labels cross-fade (see LabelFader): the name under the icon being left and the one being reached.
        private readonly IntPtr[] _label = new IntPtr[2];
        private readonly LabelFader _fader = new LabelFader();
        private readonly int[] _labelX = { int.MinValue, int.MinValue }, _labelW = new int[2], _labelAlpha = { -1, -1 };
        private int _labelY = int.MinValue;
        private IntPtr _hintChev, _hintText;
        private readonly string _hint;
        private readonly bool _hintUp;
        private int _hintW, _hintX, _hintAlpha = -1, _hintY = int.MinValue;
        private Box _dividerBox;
        private int _dividerAlpha = -1;
        private readonly IntPtr[] _icon;
        private readonly IntPtr[] _initials;       // placeholder letters for icons that failed to load

        private readonly Box[] _iconBox;
        private readonly int[] _iconAlpha;
        private Box _shadowBox, _pillBox, _hlBox, _hlBox2;
        private int _chromeAlpha = -1, _hlAlpha = -1, _hlAlpha2 = -1, _clockAlpha = -1;
        private int _clockW, _clockX = int.MinValue, _clockY = int.MinValue;
        private int _current = -1;
        private bool _clipSet;

        public int MissingIcons { get; private set; }

        public Dock(IntPtr win, DockLayout layout, AppEntry[] items, string assetsDir, Action<string> log)
            : this(win, layout, items, assetsDir, log, null, false) { }

        /// <param name="hint">Word of the navigation hint ("Input", "Back"), or null for none.</param>
        /// <param name="hintUp">True: chevron up, capsule above the pill; false: chevron down, below it.</param>
        public Dock(IntPtr win, DockLayout layout, AppEntry[] items, string assetsDir, Action<string> log, string hint, bool hintUp)
        {
            _win = win; _layout = layout; _items = items; _assets = assetsDir; _log = log;
            _hint = hint; _hintUp = hintUp;
            _evas = Efl.evas_object_evas_get(win);
            _icon = new IntPtr[items.Length];
            _initials = new IntPtr[items.Length];
            _iconBox = new Box[items.Length];
            _iconAlpha = new int[items.Length];
            for (int i = 0; i < items.Length; i++) { _iconBox[i].W = -1; _iconAlpha[i] = -1; }
            _shadowBox.W = _pillBox.W = _hlBox.W = _hlBox2.W = -1;
        }

        public IntPtr Evas { get { return _evas; } }

        public void Build()
        {
            // z-order is creation order: shadow < pill < highlight < icons < label.
            _shadow = NineSlice("shadow", 66);
            _pill = NineSlice("dock_bg", 56);
            // No selector shape: the focused icon grows and a soft glow, drawn at its final size, sits behind it.
            _highlight = NineSlice("dock_glow", 0);
            _highlight2 = NineSlice("dock_glow", 0);

            _clip = Efl.evas_object_rectangle_add(_evas);
            Efl.evas_object_color_set(_clip, 255, 255, 255, 255);
            Efl.evas_object_show(_clip);
            // The apps scroll under their own clipper, itself clipped by the page clipper: hiding the page
            // still takes everything with it, while the pinned entries, the glow and the divider stay uncut.
            _appsClip = Efl.evas_object_rectangle_add(_evas);
            Efl.evas_object_color_set(_appsClip, 255, 255, 255, 255);
            Efl.evas_object_clip_set(_appsClip, _clip);
            Efl.evas_object_show(_appsClip);

            for (int i = 0; i < _items.Length; i++)
            {
                _icon[i] = LoadIcon(i);
                IntPtr clip = i < _layout.AppCount ? _appsClip : _clip;
                Efl.evas_object_clip_set(_icon[i], clip);
                if (_initials[i] != IntPtr.Zero) Efl.evas_object_clip_set(_initials[i], clip);
            }
            Efl.evas_object_clip_set(_highlight, _clip);
            Efl.evas_object_clip_set(_highlight2, _clip);

            if (_layout.GroupStart >= 0)
            {
                // Hairline before the pinned system entries; it stays put while the apps scroll.
                _divider = Efl.evas_object_rectangle_add(_evas);
                Efl.evas_object_clip_set(_divider, _clip);
                Efl.evas_object_show(_divider);
                _dividerBox.W = -1;
            }

            for (int k = 0; k < 2; k++)
            {
                _label[k] = Efl.evas_object_text_add(_evas);
                Efl.evas_object_text_font_set(_label[k], Font, 26);
                SoftShadow(_label[k]);
                TintText(_label[k], 0);
                Efl.evas_object_show(_label[k]);
            }

            _clock = Efl.evas_object_text_add(_evas);
            Efl.evas_object_text_font_set(_clock, Font, 22);
            Efl.evas_object_text_text_set(_clock, "--:--");
            _clockW = Efl.evas_object_text_horiz_advance_get(_clock);
            SoftShadow(_clock);
            Efl.evas_object_show(_clock);

            if (_hint != null) BuildHint();
        }

        private const int HintChev = 24, HintGap = 4;

        private const int ShadowAlpha = 150;

        /// <summary>Text opacity (0..255). The shadow has its own colour and must fade with the text, or a faded or
        /// vanished name would leave its shadow behind as a halo.</summary>
        private static void TintText(IntPtr text, int a)
        {
            Tint(text, a);
            Efl.evas_object_text_shadow_color_set(text, 0, 0, 0, ShadowAlpha * a / 255);
        }

        private static void SoftShadow(IntPtr text)
        {
            Efl.evas_object_text_style_set(text, Efl.EvasTextStyleSoftShadow);
            Efl.evas_object_text_shadow_color_set(text, 0, 0, 0, ShadowAlpha);
        }

        /// <summary>The word, then its chevron: created last so they sit above the pill, never inside the clipper.</summary>
        private void BuildHint()
        {
            _hintChev = Efl.evas_object_image_add(_evas);
            Efl.evas_object_image_file_set(_hintChev, Path.Combine(_assets, _hintUp ? "chev_up.png" : "chev_down.png"), null);
            if (Efl.evas_object_image_load_error_get(_hintChev) != Efl.EvasLoadErrorNone) _log("asset missing: chevron");
            Efl.evas_object_image_filled_set(_hintChev, true);
            Efl.evas_object_image_smooth_scale_set(_hintChev, true);
            Efl.evas_object_resize(_hintChev, HintChev, HintChev);
            Efl.evas_object_show(_hintChev);
            _hintText = Efl.evas_object_text_add(_evas);
            Efl.evas_object_text_font_set(_hintText, Font, 22);
            Efl.evas_object_text_text_set(_hintText, _hint);
            // No backing shape: a soft dark shadow keeps the word readable over bright video.
            SoftShadow(_hintText);
            Efl.evas_object_show(_hintText);
            _hintTextW = Efl.evas_object_text_horiz_advance_get(_hintText);
            int textH = Efl.evas_object_text_vert_advance_get(_hintText);
            _hintW = _hintTextW + HintGap + HintChev;
            _hintX = _layout.HintLeft(_hintW);
            _hintTextDy = (DockLayout.CapsuleH - textH) / 2 - 1;
        }

        private int _hintTextW;
        private int _hintTextDy;

        /// <summary>
        /// Shows or hides the whole page. Hiding the clipper hides every icon and the highlight
        /// with it, so four calls cover the page; the objects keep their state for the way back.
        /// </summary>
        public void SetVisible(bool visible)
        {
            IntPtr[] top = { _shadow, _pill, _clip, _label[0], _label[1], _clock, _hintChev, _hintText };
            foreach (IntPtr o in top)
            {
                if (o == IntPtr.Zero) continue;
                if (visible) Efl.evas_object_show(o); else Efl.evas_object_hide(o);
            }
        }

        /// <summary>Item that is in use right now (the active input): its label says so. -1 for none.</summary>
        public int CurrentIndex
        {
            get { return _current; }
            set { if (value != _current) { _current = value; _fader.Invalidate(); } }
        }

        public void SetClock(string text)
        {
            Efl.evas_object_text_text_set(_clock, text);
            _clockW = Efl.evas_object_text_horiz_advance_get(_clock);
            _clockX = int.MinValue;   // re-place on the next frame: the width may have changed
        }

        private IntPtr NineSlice(string name, int border) { return NineSlice(name, border, border, border, border); }

        private IntPtr NineSlice(string name, int l, int r, int t, int b)
        {
            IntPtr img = Efl.evas_object_image_add(_evas);
            Efl.evas_object_image_file_set(img, Path.Combine(_assets, name + ".png"), null);
            if (Efl.evas_object_image_load_error_get(img) != Efl.EvasLoadErrorNone) _log("asset missing: " + name);
            Efl.evas_object_image_filled_set(img, true);
            Efl.evas_object_image_border_set(img, l, r, t, b);
            Efl.evas_object_image_border_center_fill_set(img, 1);
            Efl.evas_object_image_smooth_scale_set(img, true);
            Efl.evas_object_show(img);
            return img;
        }

        private IntPtr LoadIcon(int idx)
        {
            AppEntry e = _items[idx];
            IntPtr img = Efl.evas_object_image_add(_evas);
            Efl.evas_object_image_file_set(img, Path.Combine(_assets, "icons", e.Slug + ".png"), null);
            if (Efl.evas_object_image_load_error_get(img) != Efl.EvasLoadErrorNone)
            {
                // No icon on disk: a plain glass tile with the app's initials keeps the entry usable.
                MissingIcons++;
                _log("icon missing: " + e.Slug);
                Efl.evas_object_image_file_set(img, Path.Combine(_assets, "glass_tile.png"), null);
                IntPtr t = Efl.evas_object_text_add(_evas);
                Efl.evas_object_text_font_set(t, Font, 40);
                Efl.evas_object_text_text_set(t, Initials(e.Label));
                Efl.evas_object_show(t);
                _initials[idx] = t;
            }
            Efl.evas_object_image_filled_set(img, true);
            Efl.evas_object_image_smooth_scale_set(img, true);
            Efl.evas_object_image_scale_hint_set(img, Efl.EvasImageScaleHintDynamic);
            Efl.evas_object_show(img);
            return img;
        }

        public static string Initials(string name)
        {
            string[] p = name.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (p.Length >= 2) return char.ToUpperInvariant(p[0][0]).ToString() + char.ToUpperInvariant(p[1][0]);
            return name.Length > 0 ? char.ToUpperInvariant(name[0]).ToString() : "?";
        }

        private static void Place(IntPtr o, ref Box last, Box b)
        {
            if (b.X != last.X || b.Y != last.Y) Efl.evas_object_move(o, b.X, b.Y);
            if (b.W != last.W || b.H != last.H) Efl.evas_object_resize(o, b.W, b.H);
            last = b;
        }

        /// <summary>Premultiplied white at the given opacity (0..255).</summary>
        private static void Tint(IntPtr o, int a) { Efl.evas_object_color_set(o, a, a, a, a); }

        public void Apply(Controller c)
        {
            int slide = c.Slide;
            int presence = (int)Math.Round(255f * c.Presence);
            float fp = c.FocusPos, scroll = c.Scroll;

            // Backdrop: moves only while the dock slides in or out.
            Place(_shadow, ref _shadowBox, _layout.ShadowBox(slide));
            Place(_pill, ref _pillBox, _layout.PillBox(slide));
            if (presence != _chromeAlpha)
            {
                _chromeAlpha = presence;
                Tint(_shadow, presence);
                Tint(_pill, presence);
            }

            if (!_clipSet)
            {
                _clipSet = true;
                Efl.evas_object_move(_clip, 0, 0);
                Efl.evas_object_resize(_clip, _layout.WinW, _layout.WinH);
                Efl.evas_object_move(_appsClip, _layout.ViewLeft - DockLayout.ClipPad, 0);
                Efl.evas_object_resize(_appsClip, _layout.ViewportW + 2 * DockLayout.ClipPad, _layout.WinH);
            }

            // The glow never slides: it dies out on the icon being left while it lights up on the one being
            // reached (two objects, one per icon), following the same eased focus as the icon growth.
            int g1, g2; float w2;
            _layout.GlowAt(fp, out g1, out g2, out w2);
            Place(_highlight, ref _hlBox, _layout.GlowBox(g1, scroll, slide));
            Place(_highlight2, ref _hlBox2, _layout.GlowBox(g2, scroll, slide));
            int ga1 = (int)Math.Round(presence * (1f - w2)), ga2 = (int)Math.Round(presence * w2);
            if (ga1 != _hlAlpha) { _hlAlpha = ga1; Tint(_highlight, ga1); }
            if (ga2 != _hlAlpha2) { _hlAlpha2 = ga2; Tint(_highlight2, ga2); }

            for (int i = 0; i < _icon.Length; i++)
            {
                Box b = _layout.IconBox(i, fp, scroll, slide);
                Place(_icon[i], ref _iconBox[i], b);

                float amount = DockLayout.Amount(fp, i);
                int a = (int)Math.Round(presence * (0.88f + 0.12f * amount));
                if (a != _iconAlpha[i])
                {
                    _iconAlpha[i] = a;
                    Tint(_icon[i], a);
                    if (_initials[i] != IntPtr.Zero) Efl.evas_object_color_set(_initials[i], a, a, a, a);
                }
                if (_initials[i] != IntPtr.Zero)
                {
                    int w = Efl.evas_object_text_horiz_advance_get(_initials[i]);
                    int h = Efl.evas_object_text_vert_advance_get(_initials[i]);
                    Efl.evas_object_move(_initials[i], b.X + (b.W - w) / 2, b.Y + (b.H - h) / 2);
                }
            }

            if (_divider != IntPtr.Zero)
            {
                Place(_divider, ref _dividerBox, _layout.DividerBox(scroll, slide));
                int da = (int)Math.Round(presence * 0.4f);     // a hairline: felt more than seen
                if (da != _dividerAlpha) { _dividerAlpha = da; Tint(_divider, da); }
            }

            ApplyLabels(c, slide, presence, scroll);
            ApplyClock(slide, presence);
            if (_hintText != IntPtr.Zero) ApplyHint(slide, presence);
        }

        private void ApplyHint(int slide, int presence)
        {
            int y = _layout.HintTop(slide);
            if (y != _hintY)
            {
                _hintY = y;
                Efl.evas_object_move(_hintText, _hintX, y + _hintTextDy);
                Efl.evas_object_move(_hintChev, _hintX + _hintTextW + HintGap, y + (DockLayout.CapsuleH - HintChev) / 2);
            }
            // Quieter than the label, like the clock: a signpost, not a headline.
            if (presence != _hintAlpha)
            {
                _hintAlpha = presence;
                int a = presence * 9 / 10;
                Tint(_hintChev, a);
                TintText(_hintText, a);
            }
        }

        private void ApplyClock(int slide, int presence)
        {
            int x = _layout.ClockRight - _clockW;
            int y = _layout.LabelTop(slide) + 3;
            if (x != _clockX || y != _clockY)
            {
                _clockX = x; _clockY = y;
                Efl.evas_object_move(_clock, x, y);
            }
            // Quieter than the label: it is there to be glanced at, not read. It gives way to the label.
            int ts = _fader.TargetSlot;
            int a = _layout.ClockClear(_labelX[ts], _labelW[ts], _clockW) ? presence * 7 / 10 : 0;
            if (a != _clockAlpha) { _clockAlpha = a; TintText(_clock, a); }
        }

        private void ApplyLabels(Controller c, int slide, int presence, float scroll)
        {
            _fader.Update(c.FocusTarget, c.FocusPos);
            int y = _layout.LabelTop(slide);
            bool moveY = y != _labelY;
            _labelY = y;
            for (int k = 0; k < 2; k++)
            {
                int idx = _fader.Index[k];
                if ((_fader.Dirty & (1 << k)) != 0 && idx >= 0)
                {
                    string text = idx == _current ? _items[idx].Label + "  \u00b7  current" : _items[idx].Label;
                    Efl.evas_object_text_text_set(_label[k], text);
                    _labelW[k] = Efl.evas_object_text_horiz_advance_get(_label[k]);
                    _labelX[k] = int.MinValue;   // placed again below
                }
                int a = idx < 0 ? 0 : (int)Math.Round(presence * _fader.Weight[k]);
                if (idx >= 0)
                {
                    int x = _layout.LabelLeft(idx, scroll, _labelW[k]);
                    if (x != _labelX[k] || moveY) { _labelX[k] = x; Efl.evas_object_move(_label[k], x, y); }
                }
                if (a != _labelAlpha[k]) { _labelAlpha[k] = a; TintText(_label[k], a); }
            }
            _fader.ClearDirty();
        }
    }
}
