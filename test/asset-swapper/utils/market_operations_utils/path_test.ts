import * as chai from 'chai';
import 'mocha';
import {
    BigNumber,
    ERC20BridgeSource,
    Fill,
    FillQuoteTransformerOrderType,
    MarketOperation,
} from '../../../../src/asset-swapper';
import { MAX_UINT256, ONE_ETHER } from '../../../../src/asset-swapper/utils/market_operation_utils/constants';
import { Path } from '../../../../src/asset-swapper/utils/market_operation_utils/path';
import { chaiSetup } from '../chai_setup';

chaiSetup.configure();
const expect = chai.expect;

// TODO: add tests for MarketOperation.Buy
describe('Path', () => {
    describe('adjustedRate()', () => {
        it('Returns the adjusted rate based on adjustedOutput and exchange proxy overhead', () => {
            const path = Path.create(
                MarketOperation.Sell,
                [createFakeFill({ input: ONE_ETHER, adjustedOutput: ONE_ETHER.times(990) })],
                ONE_ETHER,
                {
                    inputAmountPerEth: new BigNumber(1),
                    outputAmountPerEth: new BigNumber(1000),
                    exchangeProxyOverhead: () => ONE_ETHER.times(0.01), // 10 * 10e18 output amount
                },
            );

            // 990 (adjusted output) - 10 (overhead)
            expect(path.adjustedRate()).bignumber.eq(new BigNumber(990 - 10));
        });

        it('Returns the adjusted rate without interpolating penalty when sum of the input amounts is greater than the target input amount', () => {
            const path = Path.create(
                MarketOperation.Sell,
                [
                    createFakeFill({
                        input: ONE_ETHER,
                        adjustedOutput: ONE_ETHER.times(990),
                    }),
                    createFakeFill({
                        input: ONE_ETHER,
                        output: ONE_ETHER.times(1000),
                        adjustedOutput: ONE_ETHER.times(990),
                    }),
                ],
                ONE_ETHER.times(1.5),
                {
                    inputAmountPerEth: new BigNumber(1),
                    outputAmountPerEth: new BigNumber(1000),
                    exchangeProxyOverhead: () => ONE_ETHER.times(0.01), // 10 * 10e18 output amount
                },
            );

            // 990 (adjusted output) + 1000 (output) /2 - 10 (penalty) - 10 (overhead)
            expect(path.adjustedRate()).bignumber.eq(new BigNumber(990 + 1000 / 2 - 10 - 10).div(1.5));
        });
    });

    describe('source flags', () => {
        it('Returns merged source flags from fills', () => {
            const path = Path.create(
                MarketOperation.Sell,
                [
                    createFakeFillWithFlags(BigInt(1)),
                    createFakeFillWithFlags(BigInt(2)),
                    createFakeFillWithFlags(BigInt(8)),
                ],
                ONE_ETHER,
                {
                    inputAmountPerEth: new BigNumber(1),
                    outputAmountPerEth: new BigNumber(1),
                    exchangeProxyOverhead: () => new BigNumber(0),
                },
            );

            expect(path.sourceFlags).eq(BigInt(1 + 2 + 8));
        });
    });

    describe('createOrders()', () => {
        it('Returns a corresponding `OptimizedOrder` for a single native order (sell)', () => {
            const path = Path.create(
                MarketOperation.Sell,
                [
                    {
                        input: ONE_ETHER,
                        output: ONE_ETHER.times(1000),
                        adjustedOutput: ONE_ETHER.times(1000),
                        gas: 0,
                        source: ERC20BridgeSource.Native,
                        type: FillQuoteTransformerOrderType.Otc,
                        fillData: {
                            order: {
                                takerToken: 'fake-weth-address',
                                makerToken: 'fake-usdc-address',
                            },
                        },
                        sourcePathId: 'fake-path-id',
                        flags: BigInt(0),
                    },
                ],
                ONE_ETHER,
                {
                    inputAmountPerEth: new BigNumber(1),
                    outputAmountPerEth: new BigNumber(1000),
                    exchangeProxyOverhead: () => new BigNumber(0),
                },
            );

            const orders = path.createOrders({
                inputToken: 'fake-weth-address',
                outputToken: 'fake-usdc-address',
                side: MarketOperation.Sell,
            });

            expect(orders).to.deep.eq([
                {
                    type: FillQuoteTransformerOrderType.Otc,
                    source: ERC20BridgeSource.Native,
                    makerToken: 'fake-usdc-address',
                    takerToken: 'fake-weth-address',
                    takerAmount: ONE_ETHER,
                    makerAmount: ONE_ETHER.times(1000),
                    fillData: {
                        order: {
                            takerToken: 'fake-weth-address',
                            makerToken: 'fake-usdc-address',
                        },
                    },
                    fill: {
                        input: ONE_ETHER,
                        output: ONE_ETHER.times(1000),
                        adjustedOutput: ONE_ETHER.times(1000),
                        gas: 0,
                    },
                },
            ]);
        });

        it('Returns a corresponding `OptimizedOrder`s for a single bridge order (sell)', () => {
            const path = Path.create(
                MarketOperation.Sell,
                [
                    {
                        input: ONE_ETHER,
                        output: ONE_ETHER.times(1000),
                        adjustedOutput: ONE_ETHER.times(990),
                        gas: 0,
                        source: ERC20BridgeSource.UniswapV2,
                        type: FillQuoteTransformerOrderType.Bridge,
                        fillData: { fakeFillData: 'fakeFillData' },
                        sourcePathId: 'fake-path-id',
                        flags: BigInt(0),
                    },
                ],
                ONE_ETHER,
                {
                    inputAmountPerEth: new BigNumber(1),
                    outputAmountPerEth: new BigNumber(1000),
                    exchangeProxyOverhead: () => new BigNumber(0),
                },
            );

            const orders = path.createOrders({
                inputToken: 'fake-weth-address',
                outputToken: 'fake-usdc-address',
                side: MarketOperation.Sell,
            });

            expect(orders).to.deep.eq([
                {
                    type: FillQuoteTransformerOrderType.Bridge,
                    source: ERC20BridgeSource.UniswapV2,
                    makerToken: 'fake-usdc-address',
                    takerToken: 'fake-weth-address',
                    takerAmount: ONE_ETHER,
                    makerAmount: ONE_ETHER.times(1000),
                    fillData: { fakeFillData: 'fakeFillData' },
                    fill: {
                        input: ONE_ETHER,
                        output: ONE_ETHER.times(1000),
                        adjustedOutput: ONE_ETHER.times(990),
                        gas: 0,
                    },
                },
            ]);
        });

        it('Returns corresponding `OptimizedOrder`s for a two hop order (sell)', () => {
            const path = Path.create(
                MarketOperation.Sell,
                [
                    {
                        input: ONE_ETHER,
                        output: ONE_ETHER.times(1000),
                        adjustedOutput: ONE_ETHER.times(990),
                        gas: 0,
                        source: ERC20BridgeSource.MultiHop,
                        type: FillQuoteTransformerOrderType.Bridge,
                        fillData: {
                            firstHopSource: {
                                source: ERC20BridgeSource.Curve,
                                fillData: { fakeFillData: 'curve' },
                                encodeCall: () => '',
                                handleCallResults: () => [new BigNumber(0)],
                                handleRevert: () => [new BigNumber(0)],
                            },
                            secondHopSource: {
                                source: ERC20BridgeSource.BalancerV2,
                                fillData: { fakeFillData: 'balancer v2' },
                                encodeCall: () => '',
                                handleCallResults: () => [new BigNumber(0)],
                                handleRevert: () => [new BigNumber(0)],
                            },
                            intermediateToken: 'fake-usdt-address',
                        },
                        sourcePathId: 'fake-path-id',
                        flags: BigInt(0),
                    },
                ],
                ONE_ETHER,
                {
                    inputAmountPerEth: new BigNumber(1),
                    outputAmountPerEth: new BigNumber(1000),
                    exchangeProxyOverhead: () => new BigNumber(0),
                },
            );

            const orders = path.createOrders({
                inputToken: 'fake-weth-address',
                outputToken: 'fake-usdc-address',
                side: MarketOperation.Sell,
            });

            expect(orders).deep.eq([
                {
                    type: FillQuoteTransformerOrderType.Bridge,
                    source: ERC20BridgeSource.Curve,
                    takerToken: 'fake-weth-address',
                    makerToken: 'fake-usdt-address',
                    takerAmount: ONE_ETHER,
                    makerAmount: new BigNumber(0),
                    fillData: { fakeFillData: 'curve' },
                    fill: {
                        input: ONE_ETHER,
                        output: new BigNumber(0),
                        adjustedOutput: new BigNumber(0),
                        gas: 1,
                    },
                },
                {
                    type: FillQuoteTransformerOrderType.Bridge,
                    source: ERC20BridgeSource.BalancerV2,
                    takerToken: 'fake-usdt-address',
                    makerToken: 'fake-usdc-address',
                    takerAmount: MAX_UINT256,
                    makerAmount: ONE_ETHER.times(1000),
                    fillData: { fakeFillData: 'balancer v2' },
                    fill: {
                        input: MAX_UINT256,
                        output: ONE_ETHER.times(1000),
                        adjustedOutput: ONE_ETHER.times(1000),
                        gas: 1,
                    },
                },
            ]);
        });
    });
});

function createFakeFill(params: { input: BigNumber; output?: BigNumber; adjustedOutput: BigNumber }): Fill {
    const { input, output, adjustedOutput } = params;
    return {
        input,
        output: output || new BigNumber(0),
        adjustedOutput,
        gas: 42,
        source: ERC20BridgeSource.UniswapV3,
        type: FillQuoteTransformerOrderType.Bridge,
        fillData: {},
        sourcePathId: 'fake-path-id',
        flags: BigInt(0),
    };
}

function createFakeFillWithFlags(flags: bigint): Fill {
    return {
        input: ONE_ETHER,
        output: ONE_ETHER,
        adjustedOutput: ONE_ETHER,
        gas: 42,
        source: ERC20BridgeSource.UniswapV3,
        type: FillQuoteTransformerOrderType.Bridge,
        fillData: {},
        sourcePathId: 'fake-path-id',
        flags,
    };
}