/* eslint-disable no-console */
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('GaslessTokenTransfer', function () {
  let relayer, user, receiver;
  let token, gasless;

  beforeEach(async function () {
    [relayer, user, receiver] = await ethers.getSigners();

    const ERC20Permit = await ethers.getContractFactory('ERC20Permit');
    token = await ERC20Permit.deploy('DemoToken', 'DMT', 18);
    await token.deployed();

    const mintAmount = ethers.utils.parseUnits('1000', 18);
    await (await token.mint(user.address, mintAmount)).wait();

    const Gasless = await ethers.getContractFactory('GaslessTokenTransfer');
    gasless = await Gasless.deploy();
    await gasless.deployed();
  });

  it('executes gasless transfer using permit', async function () {
    const amount = ethers.utils.parseUnits('10', 18);
    const fee = ethers.utils.parseUnits('0.1', 18);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const nonce = await token.nonces(user.address);
    const name = await token.name();
    const chainId = await user.getChainId();

    const domain = {
      name,
      version: '1',
      chainId,
      verifyingContract: token.address
    };
    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };
    const value = amount.add(fee);
    const message = {
      owner: user.address,
      spender: gasless.address,
      value: value.toString(),
      nonce: nonce.toString(),
      deadline
    };

    const sig = await user._signTypedData(domain, types, message);
    const { v, r, s } = ethers.utils.splitSignature(sig);

    const beforeReceiver = await token.balanceOf(receiver.address);
    const beforeRelayer = await token.balanceOf(relayer.address);

    await expect(
      gasless
        .connect(relayer)
        .send(token.address, user.address, receiver.address, amount, fee, deadline, v, r, s)
    ).to.emit(token, 'Transfer');

    const afterReceiver = await token.balanceOf(receiver.address);
    const afterRelayer = await token.balanceOf(relayer.address);

    expect(afterReceiver.sub(beforeReceiver)).to.equal(amount);
    expect(afterRelayer.sub(beforeRelayer)).to.equal(fee);
  });
});


