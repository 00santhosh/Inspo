import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { backdrop, colors, fonts, shadow } from '@/theme/tokens';

type Kind = 'info' | 'success' | 'error' | 'busy';
type Options = { kind?: Kind; sticky?: boolean; action?: { label: string; onPress: () => void } };
type ToastItem = { id: number; text: string } & Options;

type ToastApi = {
  /** Shows a message and returns its id. Busy and sticky messages stay until hidden. */
  show: (text: string, options?: Options) => number;
  update: (id: number, text: string, options?: Options) => void;
  hide: (id: number) => void;
};

const ToastContext = createContext<ToastApi>({ show: () => 0, update: () => {}, hide: () => {} });

export const useToast = () => useContext(ToastContext);

const DURATION = 3800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const hide = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((all) => all.filter((x) => x.id !== id));
  }, []);

  const schedule = useCallback(
    (id: number, o: Options) => {
      const t = timers.current.get(id);
      if (t) clearTimeout(t);
      timers.current.delete(id);
      if (o.sticky || o.kind === 'busy') return;
      timers.current.set(id, setTimeout(() => hide(id), o.kind === 'error' ? DURATION + 2000 : DURATION));
    },
    [hide],
  );

  const show = useCallback(
    (text: string, options: Options = {}) => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-2), { id, text, ...options }]);
      schedule(id, options);
      return id;
    },
    [schedule],
  );

  const update = useCallback(
    (id: number, text: string, options: Options = {}) => {
      setToasts((all) => all.map((x) => (x.id === id ? { ...x, text, ...options } : x)));
      schedule(id, options);
    },
    [schedule],
  );

  const api = useMemo(() => ({ show, update, hide }), [show, update, hide]);
  const insets = useSafeAreaInsets();

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
        {toasts.map((t) => (
          <Animated.View key={t.id} entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(160)} style={styles.toast}>
            {t.kind === 'busy' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : t.kind === 'success' ? (
              <Icon name="check" size={16} color="#6EE7A8" strokeWidth={2.4} />
            ) : t.kind === 'error' ? (
              <Icon name="close" size={16} color="#FF8A8A" strokeWidth={2.4} />
            ) : null}
            <Text accessibilityLiveRegion="polite" numberOfLines={3} style={styles.text}>
              {t.text}
            </Text>
            {t.action ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  t.action?.onPress();
                  hide(t.id);
                }}
                hitSlop={8}>
                <Text style={styles.action}>{t.action.label}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8, zIndex: 100 },
  toast: {
    maxWidth: 460,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dock,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    boxShadow: shadow.dock,
    ...backdrop(18),
  },
  text: { flexShrink: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 19, fontWeight: '500', color: colors.text },
  action: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '700', color: '#7FB0FF' },
});
