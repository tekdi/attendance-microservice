import { Injectable } from '@nestjs/common';
import axios from 'axios';


@Injectable()
export class AxiosRequest {
  constructor() {}

  async postAxiosRequest(body,url,key) {
    const data = JSON.stringify(body);
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: `key=${key}`,
        'Content-Type': 'application/json',
      },
      data: data,
    };
    const response = axios
      .request(config)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        throw error;
      });
    return response;
  }

  async getAxiosRequest(url,key) {
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: `key=${key}`,
        'Content-Type': 'application/json',
      },
    };
    const response = axios
      .request(config)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        throw error;
      });
    return response;
  }

  
}