import { describe, it, expect } from 'vitest';
import {
    ACTIONS,
    ACTION_IDS,
    ACTION_LABELS,
    getAction,
    filterActions,
    type ActionLabel,
} from '../src/rl/actions.js';

describe('Paper §4 Abstract Actions', () => {
    it('defines exactly 5 canonical abstract action labels', () => {
        expect(ACTION_LABELS).toHaveLength(5);
        expect(ACTIONS).toHaveLength(5);
        expect(ACTION_IDS).toHaveLength(5);

        const expectedActions: ActionLabel[] = [
            'HOLD',
            'ACQUIRE_SPOT',
            'DISPOSE_SPOT',
            'PROVIDE_LIQUIDITY',
            'REDUCE_INVENTORY',
        ];

        expect(ACTION_LABELS).toEqual(expectedActions);
        expect(ACTION_IDS).toEqual(expectedActions);
    });

    it('contains only abstract actions without hardcoded instrument names', () => {
        for (const action of ACTIONS) {
            expect(action.id).not.toMatch(/WR_|CU_|REE_|AL_|ZN_|gGOLD|gOIL|buy_|sell_all/);
        }
    });

    it('retrieves actions by ID', () => {
        const hold = getAction('HOLD');
        expect(hold).toBeDefined();
        expect(hold?.type).toBe('HOLD');

        const acquire = getAction('ACQUIRE_SPOT');
        expect(acquire).toBeDefined();
        expect(acquire?.type).toBe('ACQUIRE_SPOT');

        const nonExistent = getAction('INVALID');
        expect(nonExistent).toBeUndefined();
    });

    it('filters actions per safety layer admissible set A_safe(z_t)', () => {
        const admissible: ActionLabel[] = ['HOLD', 'DISPOSE_SPOT'];
        const filtered = filterActions(admissible);
        expect(filtered).toEqual(['HOLD', 'DISPOSE_SPOT']);

        const all = filterActions();
        expect(all).toEqual(ACTION_IDS);
    });
});
