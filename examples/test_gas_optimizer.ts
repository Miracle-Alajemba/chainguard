import * as dotenv from "dotenv";
dotenv.config();

import { optimizeGas } from "../src/gasOptimizer";

async function main() {
  const vulnerableContractCode = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;

    contract GasWaster {
        uint256[] public numbers;
        uint256 public totalSum;
        address public owner;

        constructor() {
            owner = msg.sender;
        }

        // Multiple storage reads/writes in a loop, memory copying, require string waste
        function calculateSum() public {
            require(msg.sender == owner, "Only the owner of this contract can call this function to calculate the sum of numbers");
            for (uint256 i = 0; i < numbers.length; i++) {
                totalSum += numbers[i];
            }
        }

        function addNumber(uint256 num) public {
            require(msg.sender == owner, "Only the owner can add a number");
            numbers.push(num);
        }
    }
  `;

  console.log("Running gas optimization analysis...");
  try {
    const report = await optimizeGas(vulnerableContractCode);
    console.log("Gas Optimization Report:");
    console.log(JSON.stringify(report, null, 2));
  } catch (err: any) {
    console.error("Optimization analysis failed:", err);
  }
}

main();
