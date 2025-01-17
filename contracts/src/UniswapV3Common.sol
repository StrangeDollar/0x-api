// SPDX-License-Identifier: Apache-2.0
/*

  Copyright 2022 ZeroEx Intl.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

pragma solidity >=0.6;
pragma experimental ABIEncoderV2;

import "@0x/contracts-erc20/contracts/src/v06/IERC20TokenV06.sol";

import "./interfaces/IUniswapV3.sol";

contract UniswapV3Common {
    function toUniswapPath(
        IERC20TokenV06[] memory tokenPath,
        IUniswapV3Pool[] memory poolPath
    ) internal view returns (bytes memory uniswapPath) {
        require(
            tokenPath.length >= 2 && tokenPath.length == poolPath.length + 1,
            "UniswapV3Common/invalid path lengths"
        );
        // Uniswap paths are tightly packed as:
        // [token0, token0token1PairFee, token1, token1Token2PairFee, token2, ...]
        uniswapPath = new bytes(tokenPath.length * 20 + poolPath.length * 3);
        uint256 o;
        assembly {
            o := add(uniswapPath, 32)
        }
        for (uint256 i = 0; i < tokenPath.length; ++i) {
            if (i > 0) {
                uint24 poolFee = poolPath[i - 1].fee();
                assembly {
                    mstore(o, shl(232, poolFee))
                    o := add(o, 3)
                }
            }
            IERC20TokenV06 token = tokenPath[i];
            assembly {
                mstore(o, shl(96, token))
                o := add(o, 20)
            }
        }
    }

    function reverseTokenPath(
        IERC20TokenV06[] memory tokenPath
    ) internal pure returns (IERC20TokenV06[] memory reversed) {
        reversed = new IERC20TokenV06[](tokenPath.length);
        for (uint256 i = 0; i < tokenPath.length; ++i) {
            reversed[i] = tokenPath[tokenPath.length - i - 1];
        }
    }

    function reversePoolPath(
        IUniswapV3Pool[] memory poolPath
    ) internal pure returns (IUniswapV3Pool[] memory reversed) {
        reversed = new IUniswapV3Pool[](poolPath.length);
        for (uint256 i = 0; i < poolPath.length; ++i) {
            reversed[i] = poolPath[poolPath.length - i - 1];
        }
    }
}
