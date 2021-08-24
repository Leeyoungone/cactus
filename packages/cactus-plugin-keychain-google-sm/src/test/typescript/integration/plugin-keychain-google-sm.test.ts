import test, { Test } from "tape-promise/tape";
import express from "express";
import bodyParser from "body-parser";
import http from "http";
import { AddressInfo } from "net";
import { StatusCodes } from "http-status-codes";

import { IListenOptions, Servers } from "@hyperledger/cactus-common";

import { v4 as uuidv4 } from "uuid";

import { LogLevelDesc } from "@hyperledger/cactus-common";

import {
  IPluginKeychainGoogleSmOptions,
  PluginKeychainGoogleSm,
} from "../../../main/typescript/public-api";

import {
  DefaultApi as KeychainGoogleSmApi,
  Configuration,
} from "../../../main/typescript/generated/openapi/typescript-axios/index";

import { SecretManagerServiceClientMock } from "../mock/plugin-keychain-google-sm-mock";

const logLevel: LogLevelDesc = "TRACE";

test("get,set,has,delete alters state as expected", async (t: Test) => {
  const options: IPluginKeychainGoogleSmOptions = {
    instanceId: uuidv4(),
    keychainId: uuidv4(),
    logLevel: logLevel,
    backend: new SecretManagerServiceClientMock({
      logLevel: logLevel,
    }),
  };
  const plugin = new PluginKeychainGoogleSm(options);

  const expressApp = express();
  expressApp.use(bodyParser.json({ limit: "250mb" }));
  const server = http.createServer(expressApp);
  const listenOptions: IListenOptions = {
    hostname: "0.0.0.0",
    port: 0,
    server,
  };
  const addressInfo = (await Servers.listen(listenOptions)) as AddressInfo;
  test.onFinish(async () => await Servers.shutdown(server));
  const { address, port } = addressInfo;
  const apiHost = `http://${address}:${port}`;
  const config = new Configuration({ basePath: apiHost });
  const apiClient = new KeychainGoogleSmApi(config);

  await plugin.registerWebServices(expressApp);

  t.equal(plugin.getKeychainId(), options.keychainId, "Keychain ID set OK");
  t.equal(plugin.getInstanceId(), options.instanceId, "Instance ID set OK");

  /**
   * To implement this the key should consist of parent and secretId seperated by ?
   * For example, key = "projects/my-project?my-secret"
   */
  const key = `${uuidv4()}?${uuidv4()}`;
  const value = uuidv4();
  console.log(key);
  console.log(value);

  const hasPrior = await plugin.has(key);

  t.false(hasPrior, "hasPrior === false OK");
  // await plugin1.set(key1, value1);

  await apiClient.setKeychainEntryV1({
    key: key,
    value: value,
  });

  await apiClient.getKeychainEntryV1({
    key: key,
  });

  await apiClient.hasKeychainEntryV1({
    key: key,
  });

  await plugin.set(key, value);
  //await plugin.set(key, value);
  //why are there two plugins called

  const hasAfter = await plugin.has(key);
  t.true(hasAfter, "hasAfter === true OK");
  const valueAfter = await plugin.get(key);
  t.ok(valueAfter, "valueAfter truthy OK");
  t.equal(valueAfter, value, "valueAfter === value OK");

  await apiClient.deleteKeychainEntryV1({
    key: key,
  });

  const hasAfterDelete = await plugin.has(key);
  t.false(hasAfterDelete, "hasAfterDelete === false OK");

  const valueAfterDelete = plugin.get(key);

  const regExp = new RegExp(/secret not found*/);
  const rejectMsg = "valueAfterDelete === throws OK";
  await t.rejects(valueAfterDelete, regExp, rejectMsg);

  await plugin.registerWebServices(expressApp);

  const res1 = await apiClient.setKeychainEntryV1({
    key: key,
    value: value,
  });

  t.ok(res1.status >= 200, "res1 status >= 200 OK");
  t.ok(res1.status < 300, "res1 status < 300 OK");
  t.notOk(res1.data, "res1.data falsy, OK");

  const res2 = await apiClient.hasKeychainEntryV1({
    key: key,
  });

  t.ok(res2.status >= 200, "res2 status >= 200 OK");
  t.ok(res2.status < 300, "res2 status < 300 OK");
  // this does not compile just yet because the openapi.json also needs to be
  // fixed (and then the code rebuilt so that the code generator creates/updates)
  // the type definitions
  t.true(res2.data.isPresent, "res2.data.isPresent === true OK");

  await apiClient.deleteKeychainEntryV1({
    key: key,
  });

  const hasAfterDelete1 = await plugin.has(key);
  t.false(hasAfterDelete1, "hasAfterDelete1 === false OK");

  //const res4 = apiClient.getKeychainEntryV1({ key });
  //await t.rejects(res4, regExp, rejectMsg);
  //add try catch code and then add what the error message should be -- because of the exception wrapping

  try {
    await apiClient.getKeychainEntryV1({ key });
  } catch (out) {
    t.ok(out, "error thrown for not found endpoint truthy OK");
    t.ok(out.response, "deploy contract response truthy OK");
    t.ok(out.response.data, "out.response.data truthy OK");
    t.ok(out.response.data.error, "out.response.data.error truthy OK");
    t.true(
      out.response.data.error.includes(`${key} secret not found`),
      "HTTP 404 response for non-existent key contains legible error message OK",
    );

    t.equal(
      out.response.status,
      StatusCodes.NOT_FOUND,
      "deploy contract response status === 404 OK",
    );
    t.notok(out.response.data.success, "out.response.data.success falsy OK");
  }

  t.end();
});
