import test from 'node:test';
import assert from 'node:assert/strict';

import { collectInvalidAllowedValueProps } from '../Components/Structural/Controller/allowedValuesValidation.js';

test('collectInvalidAllowedValueProps returns empty when value is allowed', () => {
  const result = collectInvalidAllowedValueProps(
    {
      variant: {
        type: 'string',
        allowedValues: ['primary', 'secondary']
      }
    },
    {
      variant: 'primary'
    }
  );

  assert.deepEqual(result, []);
});

test('collectInvalidAllowedValueProps reports invalid provided values', () => {
  const result = collectInvalidAllowedValueProps(
    {
      variant: {
        type: 'string',
        allowedValues: ['primary', 'secondary']
      },
      size: {
        type: 'number',
        allowedValues: [12, 16]
      }
    },
    {
      variant: 'danger',
      size: 14
    }
  );

  assert.deepEqual(result, [
    {
      propName: 'variant',
      value: 'danger',
      allowedValues: ['primary', 'secondary']
    },
    {
      propName: 'size',
      value: 14,
      allowedValues: [12, 16]
    }
  ]);
});

test('collectInvalidAllowedValueProps ignores props not provided', () => {
  const result = collectInvalidAllowedValueProps(
    {
      variant: {
        type: 'string',
        allowedValues: ['primary', 'secondary']
      },
      disabled: {
        type: 'boolean'
      }
    },
    {
      disabled: true
    }
  );

  assert.deepEqual(result, []);
});

test('collectInvalidAllowedValueProps uses strict equality', () => {
  const result = collectInvalidAllowedValueProps(
    {
      amount: {
        type: 'number',
        allowedValues: [1]
      },
      active: {
        type: 'boolean',
        allowedValues: [true]
      }
    },
    {
      amount: '1',
      active: 1
    }
  );

  assert.deepEqual(result, [
    {
      propName: 'amount',
      value: '1',
      allowedValues: [1]
    },
    {
      propName: 'active',
      value: 1,
      allowedValues: [true]
    }
  ]);
});

test('collectInvalidAllowedValueProps ignores empty allowedValues arrays', () => {
  const result = collectInvalidAllowedValueProps(
    {
      variant: {
        type: 'string',
        allowedValues: []
      }
    },
    {
      variant: 'unexpected'
    }
  );

  assert.deepEqual(result, []);
});
