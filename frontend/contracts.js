/**
 * Hyper Homo - Contract Constants
 * Contains addresses, ABIs, and network information for interacting with smart contracts
 */

// Network Configuration
const HYPERLIQUID_NETWORK = {
    chainId: 998,
    chainName: 'Hyperliquid Testnet',
    rpcUrl: 'https://rpc.hyperliquid-testnet.xyz/evm',
    blockExplorerUrl: 'https://explorer.hyperliquid.xyz',
    nativeCurrency: {
        name: 'Hyper',
        symbol: 'HYPE',
        decimals: 18
    }
};

// USDC Token Contract
const USDC_CONTRACT = {
    address: '0x2B3370eE501B4a559b57D449569354196457D8Ab', // Replace with actual testnet USDC address
    decimals: 6,
    symbol: 'USDC',
    abi: [
        // ERC20 Standard Interface
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address to, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function transferFrom(address from, address to, uint256 amount) returns (bool)",
        // Events
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Approval(address indexed owner, address indexed spender, uint256 value)"
    ]
};

// Vault Contract (for deposits)
const VAULT_CONTRACT = {
    address: '0x85Ea63E10145381A350354ab98A6440cDBec84ce', // Replace with actual vault address
    abi: [
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "deposit",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "oracleWithdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "balances",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "ORACLE",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "USDC",
		"outputs": [
			{
				"internalType": "contract IERC20",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]
};

// Export all constants
export {
    HYPERLIQUID_NETWORK,
    USDC_CONTRACT,
    VAULT_CONTRACT
};

