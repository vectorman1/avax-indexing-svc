import { Injectable } from '@nestjs/common';
import { TxsRepo } from 'src/txs/tx.repo';
import { AddressDeltaAggregate } from 'src/addresses/interfaces/address-delta.aggregate';
import { TxSortOptsEnum } from 'src/txs/interfaces/tx-sort-opts.enum';
import { BigNumber } from '@ethersproject/bignumber';

@Injectable()
export class AddressesService {
  constructor(private readonly txsRepo: TxsRepo) {}

  async getDeltaAddresses(
    sortDir: string = 'desc',
  ): Promise<AddressDeltaAggregate[]> {
    const hasMore = true;
    const req = {
      address: '',
      sort: TxSortOptsEnum.BlockNumber,
      page: 0,
      limit: 10000,
    };

    const deltas = new Map<string, BigNumber>();

    while (hasMore) {
      const txs = await this.txsRepo.paged(req, true);

      txs.data.forEach((tx) => {
        if (!deltas.has(tx.from)) {
          deltas.set(tx.from, BigNumber.from(0));
        }
        if (!deltas.has(tx.to)) {
          deltas.set(tx.to, BigNumber.from(0));
        }

        deltas.set(tx.from, deltas.get(tx.from).sub(tx.value).sub(tx.gas));
        deltas.set(tx.to, deltas.get(tx.to).add(tx.value));
      });

      req.page++;

      if (txs.data.length < req.limit) {
        break;
      }
    }

    const deltaAggs = [];

    deltas.forEach((value, key) => {
      deltaAggs.push({
        address: key,
        delta: value,
      });
    });

    const sortFn =
      sortDir === 'desc'
        ? (a, b) => a.delta.sub(b.delta)
        : (a, b) => b.delta.sub(a.delta);
    deltaAggs.sort(sortFn);

    return deltaAggs
      .map((agg) => {
        return {
          address: agg.address,
          delta: agg.delta.toString(),
        };
      })
      .slice(0, 100);
  }
}
