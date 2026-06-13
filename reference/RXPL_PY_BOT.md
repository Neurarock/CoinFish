### Install and configure pre-commit hooks

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Installs the pre-commit package and sets up the git hooks for linting and checks.

```bash
pip3 install pre-commit
        pre-commit install
```

--------------------------------

### Install Local xrpl-py Package

Source: https://github.com/xrplf/xrpl-py.git/blob/main/RELEASE.md

Install the locally built package using pip to verify its functionality. Replace 'path/to/local/xrpl-py/dist/.whl' with the actual path to the built wheel file.

```bash
pip install path/to/local/xrpl-py/dist/.whl
```

--------------------------------

### Install xrpl-py

Source: https://github.com/xrplf/xrpl-py.git/blob/main/README.md

Install the xrpl-py library using pip. The library supports Python 3.10 and later.

```bash
pip3 install xrpl-py
```

--------------------------------

### Install pyenv

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Installs pyenv using Homebrew for managing Python versions.

```bash
brew install pyenv
```

--------------------------------

### Install Poetry

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Installs Poetry, a dependency management tool for Python, using a curl script.

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

--------------------------------

### Install Poetry dependencies

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Installs project dependencies defined in pyproject.toml using Poetry.

```bash
poetry install
```

--------------------------------

### startswith

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Checks if a string starts with a specified prefix. Can also check for a tuple of prefixes and specify start/end positions.

```APIDOC
## startswith(prefix)

### Description
Return True if S starts with the specified prefix, False otherwise. With optional start, test S beginning at that position. With optional end, stop comparing S at that position. prefix can also be a tuple of strings to try.

### Method
N/A (This is a string method, not an API endpoint)

### Endpoint
N/A

### Parameters
#### Path Parameters
N/A

#### Query Parameters
N/A

#### Request Body
N/A

### Request Example
N/A

### Response
#### Success Response (200)
- **bool** (bool) - True if the string starts with the prefix, False otherwise.

#### Response Example
N/A
```

--------------------------------

### Create a Network Client

Source: https://github.com/xrplf/xrpl-py.git/blob/main/README.md

Use the `xrpl.clients` library to create a network client for connecting to the XRP Ledger. This example connects to the test network.

```python
from xrpl.clients import JsonRpcClient
JSON_RPC_URL = "https://s.altnet.rippletest.net:51234"
client = JsonRpcClient(JSON_RPC_URL)
```

--------------------------------

### Install Python version with pyenv

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Installs a specific Python version (e.g., 3.11.6) using pyenv.

```bash
pyenv install 3.11.6
```

--------------------------------

### Build xrpl-py Package Locally

Source: https://github.com/xrplf/xrpl-py.git/blob/main/RELEASE.md

Use 'poetry build' to create local distribution files for the package. This is a prerequisite for local installation and testing.

```bash
poetry build
```

--------------------------------

### Run xrpld Docker container

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Starts a standalone xrpld node in a Docker container, exposing necessary ports for integration tests.

```bash
docker run \
  --detach \
  --publish 5005:5005 \
  --publish 6006:6006 \
  --volume "$PWD/.ci-config/:/etc/opt/xrpld/" \
  --name xrpld-service \
  rippleci/xrpld:develop --standalone
```

--------------------------------

### startswith(prefix) → bool

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Returns True if the string starts with the specified prefix, False otherwise.

```APIDOC
## startswith(prefix) → bool

### Description
Return True if S starts with the specified prefix, False otherwise.
With optional start, test S beginning at that position.
With optional end, stop comparing S at that position.
prefix can also be a tuple of strings to try.
```

--------------------------------

### Integer Conjugate Example

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Returns the integer itself, as the complex conjugate of any integer is the integer itself.

```python
>>> (10).conjugate()
10
```

--------------------------------

### rpartition(sep,)

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Partitions the string into three parts using the given separator, starting from the end.

```APIDOC
## rpartition(sep,)

### Description
Partition the string into three parts using the given separator.

This will search for the separator in the string, starting at the end. If
the separator is found, returns a 3-tuple containing the part before the
separator, the separator itself, and the part after it.

If the separator is not found, returns a 3-tuple containing two empty strings
and the original string.
```

--------------------------------

### Send a Payment Transaction on Testnet

Source: https://github.com/xrplf/xrpl-py.git/blob/main/README.md

This example demonstrates how to send a payment transaction on the XRP Ledger testnet using xrpl-py. It includes creating wallets, checking balances, submitting a payment, and verifying the transaction.

```python
from xrpl.account import get_balance
from xrpl.clients import JsonRpcClient
from xrpl.models import Payment, Tx
from xrpl.transaction import submit_and_wait
from xrpl.wallet import generate_faucet_wallet

# Create a client to connect to the test network
client = JsonRpcClient("https://s.altnet.rippletest.net:51234")

# Create two wallets to send money between on the test network
wallet1 = generate_faucet_wallet(client, debug=True)
wallet2 = generate_faucet_wallet(client, debug=True)

# Both balances should be zero since nothing has been sent yet
print("Balances of wallets before Payment tx")
print(get_balance(wallet1.address, client))
print(get_balance(wallet2.address, client))

# Create a Payment transaction from wallet1 to wallet2
payment_tx = Payment(
    account=wallet1.address,
    amount="1000",
    destination=wallet2.address,
)

# Submit the payment to the network and wait to see a response
#   Behind the scenes, this fills in fields which can be looked up automatically like the fee.
#   It also signs the transaction with wallet1 to prove you own the account you're paying from.
payment_response = submit_and_wait(payment_tx, client, wallet1)
print("Transaction was submitted")

# Create a "Tx" request to look up the transaction on the ledger
tx_response = client.request(Tx(transaction=payment_response.result["hash"]))

# Check whether the transaction was actually validated on ledger
print("Validated:", tx_response.result["validated"])

# Check balances after 1000 drops (.001 XRP) was sent from wallet1 to wallet2
print("Balances of wallets after Payment tx:")
print(get_balance(wallet1.address, client))
print(get_balance(wallet2.address, client))
```

--------------------------------

### title

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Returns a titlecased version of the string, where words start with an uppercase character and the rest are lowercase.

```APIDOC
## title()

### Description
Return a version of the string where each word is titlecased. More specifically, words start with uppercased characters and all remaining cased characters have lower case.

### Method
N/A (This is a string method, not an API endpoint)

### Endpoint
N/A

### Parameters
#### Path Parameters
N/A

#### Query Parameters
N/A

#### Request Body
N/A

### Request Example
N/A

### Response
#### Success Response (200)
N/A

#### Response Example
N/A
```

--------------------------------

### Wallet Properties and Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.wallet.md

Accesses properties of the wallet such as its address and private key, and provides methods to get the X-Address.

```APIDOC
## Wallet Properties and Methods

### Property: `address`

#### Description
The XRPL address that publicly identifies this wallet, formatted as a base58 string. This is identical to the `classic_address`.

### Property: `algorithm`

#### Description
Indicates the cryptographic algorithm used to derive the public/private key pair from the seed.

### Property: `classic_address`

#### Description
An alias for the `address` property. It is named `classic_address` to distinguish it from the newer X-Address standard, which includes network information, a destination tag, and the XRPL address.

### Property: `private_key`

#### Description
The private key, represented as a hexadecimal string. This key is used for creating signatures and MUST be kept confidential.

### Method: `get_xaddress()`

#### Description
Retrieves the X-Address for the wallet's account.

#### Parameters
- **tag** (int | None) - Optional - The destination tag for the address. Defaults to `None`.
- **is_test** (bool) - Optional - Specifies whether the address belongs to the test network. Defaults to `False`.

#### Returns
- `str` - The X-Address of the wallet's account.
```

--------------------------------

### Dictionary methods for BatchFlagInterface

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Provides standard dictionary methods for managing flags in Batch transactions, including clearing, copying, getting items, and updating.

```python
clear()
copy()
fromkeys(iterable, value=None,)
get(key, default=None,)
items()
keys()
pop(k)
popitem()
setdefault(key, default=None,)
update(**F)
values()
```

--------------------------------

### Remove prefix from string

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Use removeprefix() to return a new string with a specified prefix removed if the string starts with that prefix. If the string does not start with the prefix, the original string is returned.

```python
"hello world" .removeprefix("hello ")
```

```python
"hello world" .removeprefix("goodbye ")
```

--------------------------------

### Subscribe to Ledger Updates via WebSocket

Source: https://github.com/xrplf/xrpl-py.git/blob/main/README.md

Utilize `WebsocketClient` to subscribe to ledger updates. This example continuously listens for new ledger closures. Ensure the URL is correct for your network environment.

```python
from xrpl.clients import WebsocketClient
url = "wss://s.altnet.rippletest.net/"
from xrpl.models import Subscribe, StreamParameter
req = Subscribe(streams=[StreamParameter.LEDGER])
# NOTE: this code will run forever without a timeout, until the process is killed
with WebsocketClient(url) as client:
    client.send(req)
    for message in client:
        print(message)
# {'result': {'fee_base': 10, 'fee_ref': 10, 'ledger_hash': '7CD50477F23FF158B430772D8E82A961376A7B40E13C695AA849811EDF66C5C0', 'ledger_index': 18183504, 'ledger_time': 676412962, 'reserve_base': 20000000, 'reserve_inc': 5000000, 'validated_ledgers': '17469391-18183504'}, 'status': 'success', 'type': 'response'}
# {'fee_base': 10, 'fee_ref': 10, 'ledger_hash': 'BAA743DABD168BD434804416C8087B7BDEF7E6D7EAD412B9102281DD83B10D00', 'ledger_index': 18183505, 'ledger_time': 676412970, 'reserve_base': 20000000, 'reserve_inc': 5000000, 'txn_count': 0, 'type': 'ledgerClosed', 'validated_ledgers': '17469391-18183505'}
# {'fee_base': 10, 'fee_ref': 10, 'ledger_hash': 'D8227DAF8F745AE3F907B251D40B4081E019D013ABC23B68C0B1431DBADA1A46', 'ledger_index': 18183506, 'ledger_time': 676412971, 'reserve_base': 20000000, 'reserve_inc': 5000000, 'txn_count': 0, 'type': 'ledgerClosed', 'validated_ledgers': '17469391-18183506'}
# {'fee_base': 10, 'fee_ref': 10, 'ledger_hash': 'CFC412B6DDB9A402662832A781C23F0F2E842EAE6CFC539FEEB287318092C0DE', 'ledger_index': 18183507, 'ledger_time': 676412972, 'reserve_base': 20000000, 'reserve_inc': 5000000, 'txn_count': 0, 'type': 'ledgerClosed', 'validated_ledgers': '17469391-18183507'}
```

--------------------------------

### Dictionary get() Method (Python)

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Returns the value for a given key if it exists in the dictionary, otherwise returns a specified default value. Defaults to None if no default is provided.

```python
D.get(key, default=None)
```

--------------------------------

### Dictionary Methods for Transaction Flags

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Provides standard dictionary methods like `clear`, `copy`, `get`, `items`, `keys`, `pop`, `popitem`, `setdefault`, `update`, and `values` for managing transaction flags.

```python
clear() → None.  Remove all items from D.

copy() → a shallow copy of D

fromkeys(iterable, value=None,)
Create a new dictionary with keys from iterable and values set to value.

get(key, default=None,)
Return the value for key if key is in the dictionary, else default.

items() → a set-like object providing a view on D's items

keys() → a set-like object providing a view on D's keys

pop(k) → v, remove specified key and return the corresponding value.
If the key is not found, return the default if given; otherwise,
raise a KeyError.

popitem()
Remove and return a (key, value) pair as a 2-tuple.
Pairs are returned in LIFO (last-in, first-out) order.
Raises KeyError if the dict is empty.

setdefault(key, default=None,)
Insert key with a value of default if key is not in the dictionary.
Return the value for key if key is in the dictionary, else default.

update(**F) → None.  Update D from dict/iterable E and F.
If E is present and has a .keys() method, then does:  for k in E: D[k] = E[k]
If E is present and lacks a .keys() method, then does:  for k, v in E: D[k] = v
In either case, this is followed by: for k in F:  D[k] = F[k]

values() → an object providing a view on D's values
```

--------------------------------

### rsplit(sep=None, maxsplit=-1)

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Splits the string into a list of substrings, starting from the end.

```APIDOC
## rsplit(sep=None, maxsplit=-1)

### Description
Return a list of the substrings in the string, using sep as the separator string.

> sep
> : The separator used to split the string.
>   <br/>
>   When set to None (the default value), will split on any whitespace
>   character (including n r t f and spaces) and will discard
>   empty strings from the result.

> maxsplit
> : Maximum number of splits.
>   -1 (the default value) means no limit.

Splitting starts at the end of the string and works to the front.
```

--------------------------------

### Dictionary get() Method

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.pseudo_transactions.md

Returns the value for a given key if the key is in the dictionary. If the key is not found, it returns a specified default value (or None if no default is provided).

```python
d = {'a': 1, 'b': 2}
d.get('a')
1
```

```python
d.get('c', 'Not Found')
'Not Found'
```

--------------------------------

### Generate reference documentation

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Builds the project's reference documentation locally using Sphinx and Poetry.

```bash
# Go to the docs/ folder
cd docs/

# Build the docs
poetry run sphinx-apidoc -o source/ ../xrpl
poetry run make html
```

--------------------------------

### Dictionary Get Method

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Retrieves the value associated with a given key. If the key is not found, it returns a specified default value instead of raising an error.

```python
get(key, default=None,)
```

--------------------------------

### View generated documentation

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Navigates to the directory where the generated HTML documentation is located.

```bash
# Go to docs/_build/html/
cd docs/_build/html/
```

--------------------------------

### Generate Faucet Wallet

Source: https://github.com/xrplf/xrpl-py.git/blob/main/README.md

Creates a wallet from a Testnet faucet. Requires an initialized client.

```python
test_wallet = generate_faucet_wallet(client)
test_account = test_wallet.address
print("Classic address:", test_account)
# Classic address: rEQB2hhp3rg7sHj6L8YyR4GG47Cb7pfcuw
```

--------------------------------

### AMMInfo Request Model

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

The AMMInfo method gets information about an Automated Market Maker (AMM) instance.

```APIDOC
## AMMInfo Request Model

### Description
The `amm_info` method gets information about an Automated Market Maker (AMM) instance.

### Method
POST

### Endpoint
`/` (websocket endpoint)

### Parameters
#### Path Parameters
None

#### Query Parameters
None

#### Request Body
- **method** (RequestMethod) - Required - Must be "amm_info".
- **id** (int | str | None) - Optional - An identifier for the request.
- **api_version** (int) - Optional - The API version to use. Defaults to 2.
- **amm_account** (str | None) - Optional - The address of the AMM pool to look up.
- **asset** (Currency | None) - Optional - One of the assets of the AMM pool to look up.
- **asset2** (Currency | None) - Optional - The other asset of the AMM pool.

### Request Example
```json
{
  "method": "amm_info",
  "params": [
    {
      "amm_account": "0x...",
      "asset": {"currency": "USD", "issuer": "..."},
      "asset2": {"currency": "BTC", "issuer": "..."}
    }
  ]
}
```

### Response
#### Success Response (200)
- **result** (dict) - The result of the AMM info query.
  - **amm** (dict) - Information about the AMM.
    - **account** (str) - The account ID of the AMM.
    - **amount** (str) - The amount of the first asset in the AMM pool.
    - **amount2** (str) - The amount of the second asset in the AMM pool.
    - **asset** (dict) - Details of the first asset.
    - **asset2** (dict) - Details of the second asset.
    - **balance** (str) - The balance of LP tokens.
    - **flags** (int) - Flags associated with the AMM.
    - **last_ledger_sequence** (int) - The last ledger sequence this AMM was updated in.
    - **ledger_entry_type** (str) - The type of ledger entry.
    - **owner_funds** (str) - The owner funds of the AMM.
    - **parent_id** (str) - The parent ID of the AMM.
    - **sequence** (int) - The sequence number of the AMM.
    - **trading_fee** (int) - The trading fee for the AMM.
  - **ledger_hash** (str) - The hash of the ledger.
  - **ledger_index** (int) - The index of the ledger.
  - **status** (str) - The status of the request.

#### Response Example
```json
{
  "result": {
    "amm": {
      "account": "0x...",
      "amount": "1000000",
      "amount2": "500000",
      "asset": {"currency": "USD", "issuer": "..."},
      "asset2": {"currency": "BTC", "issuer": "..."},
      "balance": "1000",
      "flags": 0,
      "last_ledger_sequence": 12345,
      "ledger_entry_type": "AMM",
      "owner_funds": "200000",
      "parent_id": "...",
      "sequence": 1,
      "trading_fee": 1000
    },
    "ledger_hash": "...",
    "ledger_index": 12345,
    "status": "success"
  },
  "id": 1,
  "version": 2
}
```
```

--------------------------------

### Create Wallet from Seed

Source: https://github.com/xrplf/xrpl-py.git/blob/main/README.md

Create a wallet instance from a given seed using `xrpl.wallet.Wallet.from_seed()`. This is useful if you have a private key or seed phrase.

```python
wallet_from_seed = xrpl.wallet.Wallet.from_seed(seed)
print(wallet_from_seed)
```

--------------------------------

### Dictionary Methods for Transaction Interfaces

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Provides standard dictionary methods for managing transaction interface data, such as clear, copy, get, items, keys, pop, popitem, setdefault, update, and values.

```python
>>> d = {'a': 1, 'b': 2}
>>> d.clear()
>>> d
{}
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d2 = d.copy()
>>> d2
{'a': 1, 'b': 2}
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.get('a')
1
>>> d.get('c', 3)
3
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.items()
dict_items([('a', 1), ('b', 2)])
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.keys()
dict_keys(['a', 'b'])
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.pop('a')
1
>>> d
{'b': 2}
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.popitem()
('b', 2)
>>> d
{'a': 1}
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.setdefault('c', 3)
3
>>> d
{'a': 1, 'b': 2, 'c': 3}
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.update({'b': 3, 'c': 4})
>>> d
{'a': 1, 'b': 3, 'c': 4}
```

```python
>>> d = {'a': 1, 'b': 2}
>>> d.values()
dict_values([1, 2])
```

--------------------------------

### split

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Splits a string into a list of substrings using a separator, starting from the beginning. An optional maxsplit limits the number of splits.

```APIDOC
## split(sep=None, maxsplit=-1)

### Description
Return a list of the substrings in the string, using sep as the separator string. Splitting starts at the front of the string and works to the end. When sep is None (the default), splits on any whitespace and discards empty strings. maxsplit specifies the maximum number of splits; -1 (the default) means no limit. Note, str.split() is mainly useful for data that has been intentionally delimited. With natural text that includes punctuation, consider using the regular expression module.

### Method
N/A (This is a string method, not an API endpoint)

### Endpoint
N/A

### Parameters
#### Path Parameters
N/A

#### Query Parameters
N/A

#### Request Body
N/A

### Request Example
N/A

### Response
#### Success Response (200)
N/A

#### Response Example
N/A
```

--------------------------------

### Get Real Part of Complex Number

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Retrieves the real part of a complex number.

```python
the real part of a complex number
```

--------------------------------

### Using AsyncWebsocketClient for Fee Retrieval

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.asyncio.clients.md

Demonstrates how to use AsyncWebsocketClient with helper functions like get_fee or by making raw requests. This is suitable when not utilizing WebSocket-specific features like subscriptions.

```python
from xrpl.asyncio.clients import AsyncWebsocketClient
from xrpl.asyncio.ledger import get_fee
from xrpl.models import Fee


async with AsyncWebsocketClient(url) as client:
    # using helper functions
    print(await get_fee(client))

    # using raw requests yourself
    print(await client.request(Fee()))
```

--------------------------------

### Get Imaginary Part of Complex Number

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Retrieves the imaginary part of a complex number.

```python
the imaginary part of a complex number
```

--------------------------------

### Integer Methods and Properties

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Documentation for built-in integer methods and properties.

```APIDOC
## Integer Methods and Properties

### `bit_count()`

Number of ones in the binary representation of the absolute value of self. Also known as the population count.

```pycon
>>> bin(13)
'0b1101'
>>> (13).bit_count()
3
```

### `bit_length()`

Number of bits necessary to represent self in binary.

```pycon
>>> bin(37)
'0b100101'
>>> (37).bit_length()
6
```

### `conjugate()`

Returns self, the complex conjugate of any int.

### `denominator`

The denominator of a rational number in lowest terms.

### `imag`

The imaginary part of a complex number.

### `numerator`

The numerator of a rational number in lowest terms.

### `real`

The real part of a complex number.

### `from_bytes(bytes, byteorder='big', signed=False)`

**Class Method**: Returns the integer represented by the given array of bytes.

**Parameters**:
- **bytes**: Holds the array of bytes to convert. The argument must either support the buffer protocol or be an iterable object producing bytes.
- **byteorder**: The byte order used to represent the integer. Defaults to 'big'. Can be 'big', 'little', or `sys.byteorder`.
- **signed**: Indicates whether two’s complement is used to represent the integer. Defaults to False.

### `to_bytes(length=1, byteorder='big', signed=False)`

Returns an array of bytes representing an integer.

**Parameters**:
- **length**: Length of bytes object to use. Defaults to 1.
- **byteorder**: The byte order used to represent the integer. Defaults to 'big'. Can be 'big', 'little', or `sys.byteorder`.
- **signed**: Determines whether two’s complement is used to represent the integer. Defaults to False.
```

--------------------------------

### Get Integer Ratio

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.pseudo_transactions.md

Returns a pair of integers whose ratio is exactly equal to the original integer and with a positive denominator. Useful for representing integers as fractions.

```python
>>> (10).as_integer_ratio()
(10, 1)
```

```python
>>> (-10).as_integer_ratio()
(-10, 1)
```

```python
>>> (0).as_integer_ratio()
(0, 1)
```

--------------------------------

### Get Rational Number Numerator

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Retrieves the numerator of a rational number when expressed in its lowest terms.

```python
the numerator of a rational number in lowest terms
```

--------------------------------

### Get Rational Number Denominator

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Retrieves the denominator of a rational number when expressed in its lowest terms.

```python
the denominator of a rational number in lowest terms
```

--------------------------------

### Convert String to Lowercase

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Use lower() to get a copy of the string with all characters converted to lowercase.

```python
string.lower()
```

--------------------------------

### Run integration tests

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Executes integration tests for the project using Poetry, assuming an xrpld node is running.

```bash
poetry run poe test_integration
```

--------------------------------

### Static and Class Methods for OfferCreate

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Static and class methods for creating and decoding OfferCreate transactions.

```APIDOC
## Static and Class Methods for OfferCreate

### from_blob(tx_blob: str)

Decodes a transaction blob.

* **Parameters:**
  **tx_blob** – the tx blob to decode.
* **Returns:**
  The formatted transaction.

### from_dict(value: Dict[str, Any])

Construct a new Transaction from a dictionary of parameters.

* **Parameters:**
  **value** – The value to construct the Transaction from.
* **Returns:**
  A new Transaction object, constructed using the given parameters.
* **Raises:**
  [**XRPLModelException**](xrpl.models.md#xrpl.models.exceptions.XRPLModelException) – If the dictionary provided is invalid.

### from_xrpl(value: str | Dict[str, Any])

Creates a Transaction object based on a JSON or JSON-string representation of data

In Payment transactions, the DeliverMax field is renamed to the Amount field.

* **Parameters:**
  **value** – The dictionary or JSON string to be instantiated.
* **Returns:**
  A Transaction object instantiated from the input.
* **Raises:**
  [**XRPLModelException**](xrpl.models.md#xrpl.models.exceptions.XRPLModelException) – If Payment transactions have different values for
      amount and deliver_max fields
```

--------------------------------

### Get Latest Validated Ledger Sequence

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.asyncio.ledger.md

Retrieves the sequence number of the latest validated ledger.

```APIDOC
## GET /ledger/get_latest_validated_ledger_sequence

### Description
Returns the sequence number of the latest validated ledger.

### Method
GET

### Endpoint
/ledger/get_latest_validated_ledger_sequence

### Parameters
#### Query Parameters
- **client** (Client) - Required - The network client to use to send the request.

### Response
#### Success Response (200)
- **sequence** (int) - The sequence number of the latest validated ledger.

#### Response Example
{
  "sequence": 12345677
}
```

--------------------------------

### Run unit tests

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Executes all unit tests for the project using Poetry.

```bash
poetry run poe test_unit
```

--------------------------------

### Get Latest Open Ledger Sequence

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.asyncio.ledger.md

Retrieves the sequence number of the latest open ledger.

```APIDOC
## GET /ledger/get_latest_open_ledger_sequence

### Description
Returns the sequence number of the latest open ledger.

### Method
GET

### Endpoint
/ledger/get_latest_open_ledger_sequence

### Parameters
#### Query Parameters
- **client** (Client) - Required - The network client to use to send the request.

### Response
#### Success Response (200)
- **sequence** (int) - The sequence number of the latest open ledger.

#### Response Example
{
  "sequence": 12345678
}
```

--------------------------------

### Run faucet tests

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Executes faucet-related tests for the project using Poetry.

```bash
poetry run poe test_faucet
```

--------------------------------

### Request Class Instance Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Provides documentation for instance methods available in XRPL-Py Request models.

```APIDOC
## Instance Methods for Request Models

### `is_valid() -> bool`

#### Description
Returns whether this BaseModel is valid.

#### Returns
- bool - Whether this BaseModel is valid.

### `to_dict() -> Dict[str, Any]`

#### Description
Returns the dictionary representation of a Request.

#### Returns
- Dict[str, Any] - The dictionary representation of a Request.

### `validate() -> None`

#### Description
Raises if this object is invalid.

#### Raises
- XRPLModelException - if this object is invalid.
```

--------------------------------

### WebsocketClient Usage with Helper Functions and Raw Requests

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.clients.md

Demonstrates using WebsocketClient within a context manager for both helper functions like get_fee and raw client requests.

```python
from xrpl.clients import WebsocketClient
from xrpl.ledger import get_fee
from xrpl.models import Fee


with WebsocketClient(url) as client:
    # using helper functions
    print(get_fee(client))

    # using raw requests yourself
    print(client.request(Fee()))
```

--------------------------------

### Get Transaction Hash

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Hashes the Transaction object in the same way the ledger does. This method is only valid for signed Transaction objects.

```python
get_hash() → str
```

--------------------------------

### Publish xrpl-py to PyPI

Source: https://github.com/xrplf/xrpl-py.git/blob/main/RELEASE.md

Publish the package to PyPI using 'poetry publish'. Ensure you have obtained a PyPI publishing token beforehand.

```bash
poetry publish
```

--------------------------------

### Get Latest Validated Ledger Sequence

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.ledger.md

Retrieves the sequence number of the latest validated ledger from the XRP Ledger.

```APIDOC
## GET /ledger/get_latest_validated_ledger_sequence

### Description
Returns the sequence number of the latest validated ledger.

### Method
GET

### Endpoint
/ledger/get_latest_validated_ledger_sequence

### Parameters
#### Query Parameters
- **client** (SyncClient) - Required - The network client to use to send the request.

### Response
#### Success Response (200)
- **sequence** (int) - The sequence number of the latest validated ledger.

### Error Handling
- **XRPLRequestFailureException** - if the rippled API call fails.
```

--------------------------------

### Run individual tests

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Executes specific unit or integration tests by providing file paths.

```bash
# Works for single or multiple unit/integration tests
# Ex: poetry run poe test tests/unit/models/test_response.py tests/integration/transactions/test_account_delete.py
poetry run poe test FILE_PATHS
```

--------------------------------

### Get Latest Open Ledger Sequence

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.ledger.md

Retrieves the sequence number of the latest open ledger from the XRP Ledger.

```APIDOC
## GET /ledger/get_latest_open_ledger_sequence

### Description
Returns the sequence number of the latest open ledger.

### Method
GET

### Endpoint
/ledger/get_latest_open_ledger_sequence

### Parameters
#### Query Parameters
- **client** (SyncClient) - Required - The network client to use to send the request.

### Response
#### Success Response (200)
- **sequence** (int) - The sequence number of the latest open ledger.

### Error Handling
- **XRPLRequestFailureException** - if the rippled API call fails.
```

--------------------------------

### Integer Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Documentation for various methods available on integer types.

```APIDOC
## Integer Methods

### as_integer_ratio()

Return integer ratio.

Return a pair of integers, whose ratio is exactly equal to the original int
and with a positive denominator.

```python
>>> (10).as_integer_ratio()
(10, 1)
>>> (-10).as_integer_ratio()
(-10, 1)
>>> (0).as_integer_ratio()
(0, 1)
```

### bit_count()

Number of ones in the binary representation of the absolute value of self.

Also known as the population count.

```python
>>> bin(13)
'0b1101'
>>> (13).bit_count()
3
```

### bit_length()

Number of bits necessary to represent self in binary.

```python
>>> bin(37)
'0b100101'
>>> (37).bit_length()
6
```

### conjugate()

Returns self, the complex conjugate of any int.

### denominator

the denominator of a rational number in lowest terms

### from_bytes(bytes, byteorder='big', signed=False)

*classmethod*
Return the integer represented by the given array of bytes.

**Parameters**
- **bytes** (bytes-like object or iterable) - Holds the array of bytes to convert.
- **byteorder** (str) - The byte order ('big' or 'little'). Defaults to 'big'.
- **signed** (bool) - Indicates whether two’s complement is used. Defaults to False.

### imag

the imaginary part of a complex number

### numerator

the numerator of a rational number in lowest terms

### real

the real part of a complex number

### to_bytes(length=1, byteorder='big', signed=False)

Return an array of bytes representing an integer.

**Parameters**
- **length** (int) - Length of bytes object to use. Defaults to 1.
- **byteorder** (str) - The byte order ('big' or 'little'). Defaults to 'big'.
- **signed** (bool) - Determines whether two’s complement is used. Defaults to False.
```

--------------------------------

### rsplit

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Splits a string into a list of substrings using a separator, starting from the end. An optional maxsplit limits the number of splits.

```APIDOC
## rsplit(sep=None, maxsplit=-1)

### Description
Return a list of the substrings in the string, using sep as the separator string. Splitting starts at the end of the string and works to the front. When sep is None (the default), splits on any whitespace and discards empty strings. maxsplit specifies the maximum number of splits; -1 (the default) means no limit.

### Method
N/A (This is a string method, not an API endpoint)

### Endpoint
N/A

### Parameters
#### Path Parameters
N/A

#### Query Parameters
N/A

#### Request Body
N/A

### Request Example
N/A

### Response
#### Success Response (200)
N/A

#### Response Example
N/A
```

--------------------------------

### Prepare, Sign, and Submit Payment Transaction

Source: https://github.com/xrplf/xrpl-py.git/blob/main/README.md

Prepares a Payment transaction, signs it locally using the provided wallet, and then submits it to the XRP Ledger using reliable submission best practices. Ensure the client is initialized and the wallet is available.

```python
from xrpl.models.transactions import Payment
from xrpl.transaction import sign, submit_and_wait
from xrpl.ledger import get_latest_validated_ledger_sequence
from xrpl.account import get_next_valid_seq_number

current_validated_ledger = get_latest_validated_ledger_sequence(client)

# prepare the transaction
# the amount is expressed in drops, not XRP
# see https://xrpl.org/basic-data-types.html#specifying-currency-amounts
my_tx_payment = Payment(
    account=test_wallet.address,
    amount="2200000",
    destination="rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    last_ledger_sequence=current_validated_ledger + 20,
    sequence=get_next_valid_seq_number(test_wallet.address, client),
    fee="10",
)
# sign the transaction
my_tx_payment_signed = sign(my_tx_payment,test_wallet)

# submit the transaction
tx_response = submit_and_wait(my_tx_payment_signed, client)
```

--------------------------------

### Get Transaction Hash

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Calculates the ledger-canonical hash of a signed Transaction object. This method will raise an XRPLModelException if the transaction is not signed.

```python
transaction.get_hash()
```

--------------------------------

### Run linter with Poetry

Source: https://github.com/xrplf/xrpl-py.git/blob/main/CONTRIBUTING.md

Executes the linting process using Poetry to run the 'lint' script defined in the project's configuration.

```bash
poetry run poe lint
```

--------------------------------

### Multisign Transaction

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.transaction.md

Takes several transactions with Signer fields and creates a single transaction with all Signers that then gets signed and returned.

```APIDOC
## POST /v2/transactions/multisign

### Description
Takes several transactions with Signer fields and creates a single transaction with all Signers that then gets signed and returned.

### Method
POST

### Endpoint
/v2/transactions/multisign

### Parameters
#### Request Body
- **transaction** (object) - Required - The transaction to be multisigned.
- **tx_list** (array) - Required - A list of signed transactions to combine into a single multisigned transaction.

### Response
#### Success Response (200)
- **transaction** (object) - The multisigned transaction.

### Request Example
```json
{
  "transaction": { ... },
  "tx_list": [ { ... }, { ... } ]
}
```

### Response Example
```json
{
  "transaction": { ... } 
}
```
```

--------------------------------

### String Searching and Partitioning Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Methods for finding substrings and partitioning strings based on separators.

```APIDOC
## String Searching and Partitioning Methods

### Description
Methods to find the index of substrings or divide strings based on a separator.

### Methods

#### rfind(sub)
- **Description**: Returns the highest index in the string where substring `sub` is found. Returns -1 on failure.

#### rindex(sub)
- **Description**: Returns the highest index in the string where substring `sub` is found. Raises ValueError when the substring is not found.

#### partition(sep)
- **Description**: Partitions the string into three parts using the given separator. Returns a 3-tuple: (part before separator, separator, part after separator). If not found, returns (original string, '', '').

#### rpartition(sep)
- **Description**: Partitions the string from the end using the given separator. Returns a 3-tuple: (part before separator, separator, part after separator). If not found, returns ('', '', original string).
```

--------------------------------

### Get Transaction Fee

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.ledger.md

Queries the ledger for the current transaction fee, with options to set a maximum fee and specify the fee type.

```APIDOC
## GET /ledger/get_fee

### Description
Query the ledger for the current transaction fee.

### Method
GET

### Endpoint
/ledger/get_fee

### Parameters
#### Query Parameters
- **client** (SyncClient) - Required - The network client used to make network calls.
- **max_fee** (float | None) - Optional - The maximum fee in XRP that the user wants to pay. If load gets too high, then the fees will not scale past the maximum fee. If None, there is no ceiling for the fee. The default is 2 XRP.
- **fee_type** (str) - Optional - The type of fee to return. The options are “open” (the load-scaled fee to get into the open ledger), “minimum” (the minimum transaction fee) or “dynamic” (dynamic fee-calculation based on the queue size of the node). The default is “open”. The recommended option is “dynamic”.

### Response
#### Success Response (200)
- **fee** (str) - The transaction fee, in drops.

### Error Handling
- **XRPLException** - if an incorrect option for fee_type is passed in.
- **XRPLRequestFailureException** - if the rippled API call fails.
```

--------------------------------

### SignerEntry Instance Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Details instance methods for SignerEntry, such as converting to a dictionary.

```APIDOC
## SignerEntry Instance Methods

### Methods

#### `to_dict() -> Dict[str, Any]`
Returns the dictionary representation of a NestedModel.

* **Returns:**
  The dictionary representation of a NestedModel.
```

--------------------------------

### Get Transaction Fee

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.asyncio.ledger.md

Queries the ledger for the current transaction fee, with options to set a maximum fee and specify the fee type.

```APIDOC
## GET /ledger/get_fee

### Description
Queries the ledger for the current transaction fee.

### Method
GET

### Endpoint
/ledger/get_fee

### Parameters
#### Query Parameters
- **client** (Client) - Required - The network client used to make network calls.
- **max_fee** (float | None) - Optional - The maximum fee in XRP that the user wants to pay. Defaults to 2 XRP.
- **fee_type** (str) - Optional - The type of fee to return. Options: "open", "minimum", "dynamic". Defaults to "open".

### Response
#### Success Response (200)
- **fee** (str) - The transaction fee, in drops.

#### Response Example
{
  "fee": "1000"
}
```

--------------------------------

### BaseModel Instance Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Details instance methods for BaseModel, such as converting to a dictionary.

```APIDOC
## BaseModel Instance Methods

### Methods

#### `to_dict() -> Dict[str, Any]`
Returns the dictionary representation of a NestedModel.

* **Returns:**
  The dictionary representation of a NestedModel.
```

--------------------------------

### Integer Utility Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Documentation for various utility methods available for integers in the xrpl-py library.

```APIDOC
## Integer Utility Methods

### bit_length()

Number of bits necessary to represent self in binary.

```pycon
>>> bin(37)
'0b100101'
>>> (37).bit_length()
6
```

### conjugate()

Returns self, the complex conjugate of any int.

### denominator

the denominator of a rational number in lowest terms

### imag

the imaginary part of a complex number

### numerator

the numerator of a rational number in lowest terms

### real

the real part of a complex number
```

--------------------------------

### BaseModel Instance Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.requests.md

Details instance methods for BaseModel, including converting to a dictionary and validation.

```APIDOC
## BaseModel Instance Methods

### Description
Details instance methods for BaseModel, including converting to a dictionary and validation.

### Methods

#### `to_dict() -> Dict[str, Any]`
Returns the dictionary representation of a Request.

* **Returns:**
  Dict[str, Any] - The dictionary representation of a Request.

#### `validate() -> None`
Raises if this object is invalid.

* **Raises:**
  [**XRPLModelException**](xrpl.models.md#xrpl.models.exceptions.XRPLModelException) – if this object is invalid.
```

--------------------------------

### SignerEntry Class Methods

Source: https://github.com/xrplf/xrpl-py.git/blob/main/docs/source/xrpl.models.transactions.md

Provides documentation for class methods available on SignerEntry, such as creating instances from dictionaries or XRPL formats.

```APIDOC
## SignerEntry Class Methods

### Methods

#### `from_dict(value: Dict[str, Any]) -> Self`
Construct a new NestedModel from a dictionary of parameters.

* **Parameters:**
  * **value** (Dict[str, Any]) - The value to construct the NestedModel from.
* **Returns:**
  A new NestedModel object, constructed using the given parameters.
* **Raises:**
  [**XRPLModelException**](xrpl.models.md#xrpl.models.exceptions.XRPLModelException) – If the dictionary provided is invalid.

#### `from_xrpl(value: str | Dict[str, Any]) -> Self`
Creates a BaseModel object based on a JSON-like dictionary or a JSON string.

* **Parameters:**
  * **value** (str | Dict[str, Any]) - The dictionary or JSON string to be instantiated.
* **Returns:**
  A BaseModel object instantiated from the input.

#### `is_dict_of_model(dictionary: Any) -> bool`
Returns True if the input dictionary was derived by the `to_dict` method of an instance of this class.

* **Parameters:**
  * **dictionary** (Any) - The dictionary to check.
* **Returns:**
  True if dictionary is a dict representation of an instance of this class.

#### `is_valid() -> bool`
Returns whether this BaseModel is valid.

* **Returns:**
  Whether this BaseModel is valid.

#### `validate() -> None`
Raises if this object is invalid.

* **Raises:**
  [**XRPLModelException**](xrpl.models.md#xrpl.models.exceptions.XRPLModelException) – if this object is invalid.
```