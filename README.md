# Rarime Application contracts

This repository contains the contracts for the **Rarime Application** protocol. They can be used to keep track of existing queries and conveniently check the [iden3](https://github.com/iden3) protocol claims with ZK proofs

### Compilation

To compile the contracts, use the next script:

```bash
npm run compile
```

### Test

To run the tests, execute the following command:

```bash
npm run test
```

Or to see the coverage, run:

```bash
npm run coverage
```

### Deployment

For the deployment you need to:
1. Create an **.env** file by the example **.env.example**
2. Create a **config.json** file like **config.example.json** and fill it with the necessary data
3. Run the required command from the **package.json** file for the deployment - `npm run deploy-<network>`

To deploy a new **PoseidonFacade** contract, leave an empty line in the config. If there is an already deployed contract, you can insert the required address into the config

The config must have at least one query with key **ORGANIZATION_ADMIN**

Example config for deployment:

```json
{
  "poseidonFacade": "",
  "initDefaultQueries": [
    {
      "queryName": "ORGANIZATION_ADMIN",
      "query": {
        "metadata": "Organization admin schema query",
        "validatorAddr": "0xf39fd6e51aad8...ab8827279cfffb92266",
        "queryData": "0x",
        "isGroupLevel": false,
        "isStaticQuery": true
      },
      "isAdding": true
    }
  ]
}

```

### Local deployment

To deploy the contracts locally, run the following commands (in the different terminals):

```bash
npm run private-network
npm run deploy-localhost
```

### Bindings

The command to generate the bindings is as follows:

```bash
npm run generate-types
```

> See the full list of available commands in the `package.json` file.
