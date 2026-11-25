/*
    ATM MACHINE SIMULATION

    By Anirudh Saxena

    Uses only C basics: variables, if/else, switch, loops, functions, arrays.

    Compile:  gcc atm.c -o atm
    Run:      ./atm        (Windows: atm.exe)
    Default PIN: 1234
*/

#include <stdio.h>

#define MAX_TXN 5   /* how many transactions the mini statement remembers */

int pin = 1234;
float balance = 10000.00;

char txnType[MAX_TXN][20];
float txnAmount[MAX_TXN];
int txnCount = 0;

/* Save a transaction (keeps only the last MAX_TXN) */
void addTransaction(char type[], float amount)
{
    int i, j;

    if (txnCount == MAX_TXN)
    {
        /* shift everything up to drop the oldest one */
        for (i = 1; i < MAX_TXN; i++)
        {
            for (j = 0; j < 20; j++)
            {
                txnType[i - 1][j] = txnType[i][j];
            }
            txnAmount[i - 1] = txnAmount[i];
        }
        txnCount--;
    }

    for (i = 0; type[i] != '\0' && i < 19; i++)
    {
        txnType[txnCount][i] = type[i];
    }
    txnType[txnCount][i] = '\0';
    txnAmount[txnCount] = amount;
    txnCount++;
}

/* Clear leftover characters if the user typed letters instead of numbers */
void clearInput()
{
    int c;
    while ((c = getchar()) != '\n' && c != EOF)
    {
    }
}

void printLine()
{
    printf("==========================================\n");
}

void checkBalance()
{
    printLine();
    printf("   Your current balance: Rs. %.2f\n", balance);
    printLine();
}

void depositMoney()
{
    float amount;

    printf("\nEnter amount to deposit: Rs. ");
    if (scanf("%f", &amount) != 1)
    {
        clearInput();
        printf("Invalid input! Please enter a number.\n");
        return;
    }

    if (amount <= 0)
    {
        printf("Amount must be greater than 0.\n");
    }
    else
    {
        balance = balance + amount;
        addTransaction("Deposit", amount);
        printf("Rs. %.2f deposited successfully.\n", amount);
        printf("New balance: Rs. %.2f\n", balance);
    }
}

void withdrawMoney()
{
    float amount;

    printf("\nEnter amount to withdraw: Rs. ");
    if (scanf("%f", &amount) != 1)
    {
        clearInput();
        printf("Invalid input! Please enter a number.\n");
        return;
    }

    if (amount <= 0)
    {
        printf("Amount must be greater than 0.\n");
    }
    else if (amount > balance)
    {
        printf("Insufficient balance! You have Rs. %.2f\n", balance);
    }
    else if ((int)amount % 100 != 0)
    {
        printf("Please enter an amount in multiples of 100.\n");
    }
    else
    {
        balance = balance - amount;
        addTransaction("Withdraw", amount);
        printf("Please collect your cash: Rs. %.2f\n", amount);
        printf("Remaining balance: Rs. %.2f\n", balance);
    }
}

void changePin()
{
    int oldPin, newPin, confirmPin;

    printf("\nEnter current PIN: ");
    if (scanf("%d", &oldPin) != 1)
    {
        clearInput();
        printf("Invalid input!\n");
        return;
    }

    if (oldPin != pin)
    {
        printf("Wrong PIN! PIN not changed.\n");
        return;
    }

    printf("Enter new 4-digit PIN: ");
    if (scanf("%d", &newPin) != 1)
    {
        clearInput();
        printf("Invalid input!\n");
        return;
    }

    if (newPin < 1000 || newPin > 9999)
    {
        printf("PIN must be exactly 4 digits.\n");
        return;
    }

    printf("Confirm new PIN: ");
    if (scanf("%d", &confirmPin) != 1)
    {
        clearInput();
        printf("Invalid input!\n");
        return;
    }

    if (newPin == confirmPin)
    {
        pin = newPin;
        printf("PIN changed successfully!\n");
    }
    else
    {
        printf("PINs do not match. PIN not changed.\n");
    }
}

void miniStatement()
{
    int i;

    printLine();
    printf("          MINI STATEMENT\n");
    printLine();

    if (txnCount == 0)
    {
        printf("   No transactions yet.\n");
    }
    else
    {
        for (i = txnCount - 1; i >= 0; i--)
        {
            printf("   %-10s Rs. %.2f\n", txnType[i], txnAmount[i]);
        }
    }

    printf("------------------------------------------\n");
    printf("   Balance:   Rs. %.2f\n", balance);
    printLine();
}

/* Returns 1 if login is successful, 0 if the card gets blocked */
int login()
{
    int enteredPin;
    int attempts = 0;

    while (attempts < 3)
    {
        printf("\nEnter your 4-digit PIN: ");
        if (scanf("%d", &enteredPin) != 1)
        {
            clearInput();
            enteredPin = -1;
        }

        if (enteredPin == pin)
        {
            printf("\nLogin successful!\n");
            return 1;
        }

        attempts++;
        printf("Wrong PIN! Attempts left: %d\n", 3 - attempts);
    }

    return 0;
}

int main()
{
    int choice;

    printLine();
    printf("         WELCOME TO THE ATM\n");
    printf("            By Anirudh Saxena\n");
    printLine();

    if (login() == 0)
    {
        printf("\nToo many wrong attempts. Card blocked!\n");
        return 0;
    }

    do
    {
        printf("\n------------- ATM MENU -------------\n");
        printf("  1. Check Balance\n");
        printf("  2. Deposit Money\n");
        printf("  3. Withdraw Money\n");
        printf("  4. Mini Statement\n");
        printf("  5. Change PIN\n");
        printf("  6. Exit\n");
        printf("------------------------------------\n");
        printf("Enter your choice (1-6): ");

        if (scanf("%d", &choice) != 1)
        {
            clearInput();
            choice = 0;
        }

        switch (choice)
        {
        case 1:
            checkBalance();
            break;
        case 2:
            depositMoney();
            break;
        case 3:
            withdrawMoney();
            break;
        case 4:
            miniStatement();
            break;
        case 5:
            changePin();
            break;
        case 6:
            printf("\nThank you for using the ATM. Goodbye!\n");
            break;
        default:
            printf("\nInvalid choice! Please enter a number from 1 to 6.\n");
        }
    } while (choice != 6);

    return 0;
}
