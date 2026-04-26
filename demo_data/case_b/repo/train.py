import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--epochs", type=int, default=50)
    args = parser.parse_args()
    print(f"seed={args.seed} epochs={args.epochs}")


if __name__ == "__main__":
    main()

